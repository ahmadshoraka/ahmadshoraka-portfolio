//+------------------------------------------------------------------+
//| MicroMAP.mq4                                                     |
//| Algorithmic MicroMAP (spike + counter micro-channel + retries).  |
//| Rules from poursamadi.com/micromap and the public training video.|
//|                                                                  |
//| One market/pending position at a time. Fixed percent risk.       |
//| Up to 5 opens/day with win-count and +R/-R day locks.            |
//| Quality filters keep entries selective. Invalidates after stops. |
//|                                                                  |
//| This encodes the structural rules. It does not guarantee profit. |
//| Validate Expected payoff and Profit factor in Strategy Tester.   |
//+------------------------------------------------------------------+
#property copyright "MicroMAP EA"
#property link      "https://poursamadi.com/micromap/"
#property version   "1.07"
#property strict
#property description "Optional close-confirm entry and BE at +1R (inputs, default off)."
#property description "v1.07: 3-5 trades/day capacity with profit/loss R locks (keeps quality filters)."

enum ENUM_MM_ENTRY_MODE
{
   MM_CLASSIC_CHAIN = 0, // EN1 then EN2 then EN3 after each stop
   MM_H2_CONFIRM    = 1, // enter only on confirmed H2/L2 break
   MM_H3_CONFIRM    = 2, // enter only on confirmed H3/L3 break
   MM_INSIDE_FIRST  = 3  // prefer inside-bar entry when present
};

input int                MagicNumber              = 260923;
input double             RiskPercent              = 0.5;   // risk per trade, % of day-start balance
input int                MaxTradesPerDay          = 5;     // allow 3-5 quality opens per day
input bool               StopAfterFirstWin        = false; // false = multi-trade day; true = lock after 1st win
input int                MaxWinsPerDay            = 3;     // 0=off; stop new entries after N winning closes
input double             DailyProfitLockR         = 4.0;   // 0=off; stop when day net >= this * 1R money
input double             DailyLossLockR           = 3.0;   // 0=off; stop when day gross loss >= this * 1R
input int                MinBarsBetweenTrades     = 4;     // cool-down bars after any close before next entry
input double             RewardRisk               = 3.0;   // TP distance / SL distance (profit preset)
input ENUM_MM_ENTRY_MODE EntryMode                = MM_H2_CONFIRM;
input int                MaxAttempts              = 1;     // 1 = no revenge re-entries after a stop
input bool               RequireBreakCloseConfirm = false; // A/B: enter only after candle closes beyond break
input int                ConfirmMaxBars           = 8;     // bars to wait for close confirm before cancel
input bool               MoveSlToBreakevenAt1R    = false; // A/B: move SL to entry after +1R
input int                SpikeLookback            = 40;
input int                AtrPeriod                = 14;
input double             SpikeBodyAtrMin          = 1.2;   // spike body >= ATR * this
input double             SpikeCloseBias           = 0.65;  // close in top/bottom fraction of range
input double             SpikeShadowMax           = 0.35;  // opposing wick <= range * this
input int                MicroMinBars             = 3;     // reject tiny 2-bar noise channels
input int                MicroMaxBars             = 12;
input double             MicroMaxBodyVsSpike      = 0.85;  // each MC body <= spike body * this
input double             BreakBufferPoints        = 2.0;   // stop-order offset beyond H/L
input double             MinSlSpreadMultiple      = 1.2;   // min SL distance vs live chart spread
input double             MinSlAtrMultiple         = 1.0;   // 0=off; widen SL to at least ATR*this
input bool               UseTrendFilter           = true;  // only trade with higher-TF EMA trend
input ENUM_TIMEFRAMES    TrendTF                  = PERIOD_H1;
input int                TrendFastMA              = 34;
input int                TrendSlowMA              = 89;
input bool               RequireTrendPriceAlign   = true;  // H1 close on correct side of slow EMA
input double             MinBreakBodyAtr          = 0.35;  // bar1 body with trend >= ATR*this; 0=off
input int                MaxSpikeAgeBars          = 24;    // reject stale spikes; 0=off
input double             MaxSlAtrMultiple         = 2.5;   // reject very wide SL vs ATR; 0=off
input int                StartHour                = 8;     // profit preset: London/NY overlap (broker time)
input int                EndHour                  = 20;
input int                FridayStopHour           = 22;
input int                MinMinutesBeforeClose    = 0;
input bool               CloseAtSessionEnd        = false;
input bool               FlatBeforeWeekend        = true;
input bool               TradeOnSunday            = false;
input int                SlippagePoints           = 80;
input bool               CancelPendingOnBreak     = true;  // cancel if structure invalidates
input bool               DrawMarkers              = true;

#define ST_IDLE        0
#define ST_PENDING     1
#define ST_IN_TRADE    2
#define ST_WAIT_RETRY  3
#define ST_COOLDOWN    4
#define ST_WAIT_CLOSE  5

int      g_state          = ST_IDLE;
int      g_dir            = 0;      // +1 buy / -1 sell
int      g_attempt        = 0;
int      g_signals        = 0;
int      g_pendingTicket  = -1;
int      g_tradeTicket    = -1;
datetime g_setupBar       = 0;
datetime g_waitBar        = 0;
datetime g_cooldownUntil  = 0;
datetime g_lastCloseTry   = 0;
double   g_entryLevel     = 0.0;
double   g_slLevel        = 0.0;
double   g_breakLevel     = 0.0;
double   g_tpLevel        = 0.0;
double   g_riskDist       = 0.0;
bool     g_beMoved        = false;
int      g_confirmBarsLeft = 0;
double   g_anchor         = 0.0;

datetime g_statsDay       = 0;
int      g_statsOrders    = -1;
int      g_statsHistory   = -1;
double   g_statsGrossProfit = 0.0;
double   g_statsGrossLoss   = 0.0;
int      g_statsTrades      = 0;
int      g_statsWins        = 0;
bool     g_statsHadWin      = false;
ENUM_TIMEFRAMES g_tf        = PERIOD_M5;
string   g_lastSkip         = "";
int      g_scanBars         = 0;
int      g_spikeHits        = 0;
int      g_mcHits           = 0;

//+------------------------------------------------------------------+
void NoteSkip(string reason)
{
   g_lastSkip = reason;
}

//+------------------------------------------------------------------+
void RefreshTF()
{
   // Always follow the chart the EA is attached to.
   g_tf = (ENUM_TIMEFRAMES)Period();
}

//+------------------------------------------------------------------+
int ChartSpreadPoints()
{
   RefreshRates();
   if(Point > 0.0 && Ask > 0.0 && Bid > 0.0 && Ask >= Bid)
   {
      int fromQuotes = (int)MathRound((Ask - Bid) / Point);
      if(fromQuotes >= 0)
         return fromQuotes;
   }
   int fromSymbol = (int)MarketInfo(Symbol(), MODE_SPREAD);
   if(fromSymbol < 0)
      return 0;
   return fromSymbol;
}

//+------------------------------------------------------------------+
int OnInit()
{
   if(RiskPercent <= 0.0 || MaxTradesPerDay < 1)
      return INIT_PARAMETERS_INCORRECT;
   if(MaxWinsPerDay < 0 || DailyProfitLockR < 0.0 || DailyLossLockR < 0.0 || MinBarsBetweenTrades < 0)
      return INIT_PARAMETERS_INCORRECT;
   if(RewardRisk <= 0.0 || MaxAttempts < 1 || MaxAttempts > 3)
      return INIT_PARAMETERS_INCORRECT;
   if(SpikeLookback < 10 || AtrPeriod < 1 || SpikeBodyAtrMin <= 0.0)
      return INIT_PARAMETERS_INCORRECT;
   if(SpikeCloseBias <= 0.5 || SpikeCloseBias > 1.0 || SpikeShadowMax <= 0.0 || SpikeShadowMax >= 1.0)
      return INIT_PARAMETERS_INCORRECT;
   if(MicroMinBars < 1 || MicroMaxBars < MicroMinBars)
      return INIT_PARAMETERS_INCORRECT;
   if(MicroMaxBodyVsSpike <= 0.0 || BreakBufferPoints < 0.0 || MinSlSpreadMultiple <= 0.0)
      return INIT_PARAMETERS_INCORRECT;
   if(MinSlAtrMultiple < 0.0)
      return INIT_PARAMETERS_INCORRECT;
   if(ConfirmMaxBars < 1)
      return INIT_PARAMETERS_INCORRECT;
   if(UseTrendFilter && (TrendFastMA < 1 || TrendSlowMA <= TrendFastMA))
      return INIT_PARAMETERS_INCORRECT;
   if(MinBreakBodyAtr < 0.0 || MaxSpikeAgeBars < 0 || MaxSlAtrMultiple < 0.0)
      return INIT_PARAMETERS_INCORRECT;
   if(StartHour < 0 || StartHour > 23 || EndHour < 1 || EndHour > 24 || StartHour >= EndHour)
      return INIT_PARAMETERS_INCORRECT;
   if(FridayStopHour < 0 || FridayStopHour > 24 || MinMinutesBeforeClose < 0)
      return INIT_PARAMETERS_INCORRECT;
   if(SlippagePoints < 0)
      return INIT_PARAMETERS_INCORRECT;

   RefreshTF();

   if(IsTesting())
      ClearGlobals();

   LoadState();

   int curSpread = ChartSpreadPoints();
   Print("MicroMAP started. symbol=", Symbol(),
         " digits=", Digits,
         " point=", DoubleToString(Point, Digits),
         " chartSpread=", curSpread,
         " chartTF=", (int)g_tf,
         " mode=", (int)EntryMode,
         " risk=", DoubleToString(RiskPercent, 2),
         "% RR=", DoubleToString(RewardRisk, 2),
         " attempts=", MaxAttempts,
         " trendFilter=", (UseTrendFilter ? "on" : "off"),
         " minSlATR=", DoubleToString(MinSlAtrMultiple, 2),
         " closeConfirm=", (RequireBreakCloseConfirm ? "on" : "off"),
         " BE@1R=", (MoveSlToBreakevenAt1R ? "on" : "off"),
         " trendPriceAlign=", (RequireTrendPriceAlign ? "on" : "off"),
         " minBreakBodyATR=", DoubleToString(MinBreakBodyAtr, 2),
         " maxSpikeAge=", MaxSpikeAgeBars,
         " maxSlATR=", DoubleToString(MaxSlAtrMultiple, 2),
         " session=", IntegerToString(StartHour), "-", IntegerToString(EndHour),
         " maxTrades/day=", MaxTradesPerDay,
         " maxWins/day=", MaxWinsPerDay,
         " profitLockR=", DoubleToString(DailyProfitLockR, 2),
         " lossLockR=", DoubleToString(DailyLossLockR, 2),
         " barsBetween=", MinBarsBetweenTrades,
         " stopAfterFirstWin=", (StopAfterFirstWin ? "yes" : "no"));
   NoteSkip("init ok");
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   SaveState();
   Comment("");
}

//+------------------------------------------------------------------+
void OnTick()
{
   RefreshTF();

   if(iTime(Symbol(), PERIOD_D1, 0) <= 0)
   {
      NoteSkip("waiting for D1 time");
      Panel();
      return;
   }
   if(iBars(Symbol(), g_tf) < SpikeLookback + MicroMaxBars + AtrPeriod + 5)
   {
      NoteSkip("not enough bars on signal TF");
      Panel();
      return;
   }

   SyncDay();
   ManageOpenTrade();
   ManagePending();

   if(MustBeFlat())
   {
      NoteSkip("flat session / weekend rule");
      CancelOurPending();
      CloseOurPositions();
      if(g_state == ST_WAIT_CLOSE || g_state == ST_PENDING || g_state == ST_WAIT_RETRY)
         ResetSetup(false);
      Panel();
      return;
   }

   if(g_state == ST_COOLDOWN && TimeCurrent() >= g_cooldownUntil)
      ResetSetup(false);

   if(g_state == ST_WAIT_RETRY)
      TryPlaceRetry();

   datetime closedBar = iTime(Symbol(), g_tf, 1);
   if(closedBar > 0 && !BarHandled(closedBar) && !IsTradeContextBusy())
   {
      MarkBar(closedBar);
      if(g_state == ST_WAIT_CLOSE)
         TryCloseConfirmEntry();
      else if(g_state == ST_IDLE)
      {
         if(!InEntryWindow())
            NoteSkip("outside entry window");
         else if(!CanOpenNewTradeToday())
            NoteSkip(DailyBlockReason());
         else
            ScanForSetup();
      }
   }

   Panel();
}

//+------------------------------------------------------------------+
string Prefix()
{
   string head = IsTesting() ? "MMT_" : "MM_";
   return head + IntegerToString(MagicNumber) + "_" + SafeSymbol() + "_";
}

//+------------------------------------------------------------------+
string SafeSymbol()
{
   string s = Symbol();
   string out = "";
   int n = StringLen(s);
   for(int i = 0; i < n; i++)
   {
      int ch = (int)StringGetChar(s, i);
      bool ok = (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9');
      out += (ok ? CharToString((uchar)ch) : "_");
   }
   return out;
}

//+------------------------------------------------------------------+
void ClearGlobals()
{
   string keys[16] = {"DAY","BAL","SIG","BAR","ST","DIR","ATT","PEND","TRD","E","SL","CD","BRK","TP","RISK","BE"};
   for(int i = 0; i < 16; i++)
      GlobalVariableDel(Prefix() + keys[i]);
}

//+------------------------------------------------------------------+
void SaveState()
{
   GlobalVariableSet(Prefix() + "ST", (double)g_state);
   GlobalVariableSet(Prefix() + "DIR", (double)g_dir);
   GlobalVariableSet(Prefix() + "ATT", (double)g_attempt);
   GlobalVariableSet(Prefix() + "PEND", (double)g_pendingTicket);
   GlobalVariableSet(Prefix() + "TRD", (double)g_tradeTicket);
   GlobalVariableSet(Prefix() + "E", g_entryLevel);
   GlobalVariableSet(Prefix() + "SL", g_slLevel);
   GlobalVariableSet(Prefix() + "BRK", g_breakLevel);
   GlobalVariableSet(Prefix() + "TP", g_tpLevel);
   GlobalVariableSet(Prefix() + "RISK", g_riskDist);
   GlobalVariableSet(Prefix() + "BE", g_beMoved ? 1.0 : 0.0);
   GlobalVariableSet(Prefix() + "CD", (double)g_cooldownUntil);
   GlobalVariableSet(Prefix() + "SIG", (double)g_signals);
}

//+------------------------------------------------------------------+
void LoadState()
{
   string p = Prefix();
   if(GlobalVariableCheck(p + "ST"))
      g_state = (int)GlobalVariableGet(p + "ST");
   if(GlobalVariableCheck(p + "DIR"))
      g_dir = (int)GlobalVariableGet(p + "DIR");
   if(GlobalVariableCheck(p + "ATT"))
      g_attempt = (int)GlobalVariableGet(p + "ATT");
   if(GlobalVariableCheck(p + "PEND"))
      g_pendingTicket = (int)GlobalVariableGet(p + "PEND");
   if(GlobalVariableCheck(p + "TRD"))
      g_tradeTicket = (int)GlobalVariableGet(p + "TRD");
   if(GlobalVariableCheck(p + "E"))
      g_entryLevel = GlobalVariableGet(p + "E");
   if(GlobalVariableCheck(p + "SL"))
      g_slLevel = GlobalVariableGet(p + "SL");
   if(GlobalVariableCheck(p + "BRK"))
      g_breakLevel = GlobalVariableGet(p + "BRK");
   if(GlobalVariableCheck(p + "TP"))
      g_tpLevel = GlobalVariableGet(p + "TP");
   if(GlobalVariableCheck(p + "RISK"))
      g_riskDist = GlobalVariableGet(p + "RISK");
   if(GlobalVariableCheck(p + "BE"))
      g_beMoved = (GlobalVariableGet(p + "BE") > 0.5);
   if(GlobalVariableCheck(p + "CD"))
      g_cooldownUntil = (datetime)GlobalVariableGet(p + "CD");
   if(GlobalVariableCheck(p + "SIG"))
      g_signals = (int)GlobalVariableGet(p + "SIG");
}

//+------------------------------------------------------------------+
void SyncDay()
{
   datetime day = iTime(Symbol(), PERIOD_D1, 0);
   string dayKey = Prefix() + "DAY";
   string balKey = Prefix() + "BAL";
   string sigKey = Prefix() + "SIG";

   bool sameDay = GlobalVariableCheck(dayKey) &&
                  ((datetime)GlobalVariableGet(dayKey) == day);
   if(sameDay)
   {
      g_anchor = GlobalVariableGet(balKey);
      if(GlobalVariableCheck(sigKey))
         g_signals = (int)GlobalVariableGet(sigKey);
      return;
   }

   g_anchor = AccountBalance() - TodayClosedNet();
   if(g_anchor <= 0.0)
      g_anchor = AccountBalance();
   g_signals = 0;
   GlobalVariableSet(dayKey, (double)day);
   GlobalVariableSet(balKey, g_anchor);
   GlobalVariableSet(sigKey, 0.0);
   SaveState();
}

//+------------------------------------------------------------------+
bool BarHandled(datetime barTime)
{
   string key = Prefix() + "BAR";
   if(!GlobalVariableCheck(key))
      return false;
   return ((datetime)GlobalVariableGet(key) == barTime);
}

//+------------------------------------------------------------------+
void MarkBar(datetime barTime)
{
   GlobalVariableSet(Prefix() + "BAR", (double)barTime);
}

//+------------------------------------------------------------------+
int EffectiveEndHour()
{
   int end = EndHour;
   if(FlatBeforeWeekend && DayOfWeek() == 5 && FridayStopHour < end)
      end = FridayStopHour;
   return end;
}

//+------------------------------------------------------------------+
bool InEntryWindow()
{
   if(!TradeOnSunday && DayOfWeek() == 0)
      return false;
   datetime now = TimeCurrent();
   int mins = TimeHour(now) * 60 + TimeMinute(now);
   int start = StartHour * 60;
   int end = EffectiveEndHour() * 60;
   if(end <= start)
      return false;
   if(mins < start || mins >= end)
      return false;
   if(MinMinutesBeforeClose > 0 && mins >= end - MinMinutesBeforeClose)
      return false;
   return true;
}

//+------------------------------------------------------------------+
bool MustBeFlat()
{
   if(!TradeOnSunday && DayOfWeek() == 0)
      return true;
   if(FlatBeforeWeekend && DayOfWeek() == 5 && TimeHour(TimeCurrent()) >= FridayStopHour)
      return true;
   if(CloseAtSessionEnd && EndHour < 24 && TimeHour(TimeCurrent()) >= EndHour)
      return true;
   return false;
}

//+------------------------------------------------------------------+
bool IsOurOrder()
{
   if(OrderSymbol() != Symbol() || OrderMagicNumber() != MagicNumber)
      return false;
   int t = OrderType();
   return (t == OP_BUY || t == OP_SELL || t == OP_BUYSTOP || t == OP_SELLSTOP);
}

//+------------------------------------------------------------------+
bool IsOurMarket()
{
   if(OrderSymbol() != Symbol() || OrderMagicNumber() != MagicNumber)
      return false;
   return (OrderType() == OP_BUY || OrderType() == OP_SELL);
}

//+------------------------------------------------------------------+
bool IsOurPending()
{
   if(OrderSymbol() != Symbol() || OrderMagicNumber() != MagicNumber)
      return false;
   return (OrderType() == OP_BUYSTOP || OrderType() == OP_SELLSTOP);
}

//+------------------------------------------------------------------+
int CountMarket()
{
   int n = 0;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         continue;
      if(IsOurMarket())
         n++;
   }
   return n;
}

//+------------------------------------------------------------------+
int CountPending()
{
   int n = 0;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         continue;
      if(IsOurPending())
         n++;
   }
   return n;
}

//+------------------------------------------------------------------+
void RefreshDayStats()
{
   datetime day = iTime(Symbol(), PERIOD_D1, 0);
   int orders = OrdersTotal();
   int history = OrdersHistoryTotal();
   if(day == g_statsDay && orders == g_statsOrders && history == g_statsHistory)
      return;

   g_statsDay = day;
   g_statsOrders = orders;
   g_statsHistory = history;
   g_statsGrossProfit = 0.0;
   g_statsGrossLoss = 0.0;
   g_statsTrades = 0;
   g_statsWins = 0;
   g_statsHadWin = false;

   for(int i = orders - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         continue;
      if(!IsOurMarket())
         continue;
      if(OrderOpenTime() >= day)
         g_statsTrades++;
   }
   for(int j = history - 1; j >= 0; j--)
   {
      if(!OrderSelect(j, SELECT_BY_POS, MODE_HISTORY))
         continue;
      if(!IsOurMarket())
         continue;
      if(OrderOpenTime() >= day)
         g_statsTrades++;
      if(OrderCloseTime() < day)
         continue;
      double pl = OrderProfit() + OrderSwap() + OrderCommission();
      if(pl > 0.0)
      {
         g_statsGrossProfit += pl;
         g_statsWins++;
         g_statsHadWin = true;
      }
      else if(pl < 0.0)
         g_statsGrossLoss += -pl;
   }
}

//+------------------------------------------------------------------+
double TodayClosedNet()
{
   RefreshDayStats();
   return g_statsGrossProfit - g_statsGrossLoss;
}

//+------------------------------------------------------------------+
double OneRMoney()
{
   if(g_anchor <= 0.0 || RiskPercent <= 0.0)
      return 0.0;
   return g_anchor * RiskPercent / 100.0;
}

//+------------------------------------------------------------------+
int TradesOpenedToday()
{
   RefreshDayStats();
   return g_statsTrades;
}

//+------------------------------------------------------------------+
int WinsClosedToday()
{
   RefreshDayStats();
   return g_statsWins;
}

//+------------------------------------------------------------------+
bool HadWinningCloseToday()
{
   RefreshDayStats();
   return g_statsHadWin;
}

//+------------------------------------------------------------------+
bool DailyTradeLimitHit()
{
   return (TradesOpenedToday() >= MaxTradesPerDay);
}

//+------------------------------------------------------------------+
bool DailyWinLimitHit()
{
   if(StopAfterFirstWin && HadWinningCloseToday())
      return true;
   if(MaxWinsPerDay > 0 && WinsClosedToday() >= MaxWinsPerDay)
      return true;
   return false;
}

//+------------------------------------------------------------------+
bool DailyProfitLockHit()
{
   if(DailyProfitLockR <= 0.0)
      return false;
   double rMoney = OneRMoney();
   if(rMoney <= 0.0)
      return false;
   return (TodayClosedNet() >= DailyProfitLockR * rMoney);
}

//+------------------------------------------------------------------+
bool DailyLossLockHit()
{
   if(DailyLossLockR <= 0.0)
      return false;
   double rMoney = OneRMoney();
   if(rMoney <= 0.0)
      return false;
   RefreshDayStats();
   return (g_statsGrossLoss >= DailyLossLockR * rMoney);
}

//+------------------------------------------------------------------+
bool CanOpenNewTradeToday()
{
   if(DailyWinLimitHit())
      return false;
   if(DailyProfitLockHit())
      return false;
   if(DailyLossLockHit())
      return false;
   if(DailyTradeLimitHit())
      return false;
   return true;
}

//+------------------------------------------------------------------+
string DailyBlockReason()
{
   if(StopAfterFirstWin && HadWinningCloseToday())
      return "stopped: first win of day already taken";
   if(MaxWinsPerDay > 0 && WinsClosedToday() >= MaxWinsPerDay)
      return "stopped: max " + IntegerToString(MaxWinsPerDay) + " wins/day";
   if(DailyProfitLockHit())
      return "stopped: daily profit lock +" + DoubleToString(DailyProfitLockR, 1) + "R";
   if(DailyLossLockHit())
      return "stopped: daily loss lock -" + DoubleToString(DailyLossLockR, 1) + "R";
   if(DailyTradeLimitHit())
      return "stopped: max " + IntegerToString(MaxTradesPerDay) + " trades/day";
   return "ready";
}

//+------------------------------------------------------------------+
double NormPrice(double price)
{
   return NormalizeDouble(price, Digits);
}

//+------------------------------------------------------------------+
double BufferDist()
{
   return BreakBufferPoints * Point;
}

//+------------------------------------------------------------------+
double BodySize(int shift)
{
   return MathAbs(iClose(Symbol(), g_tf, shift) - iOpen(Symbol(), g_tf, shift));
}

//+------------------------------------------------------------------+
double RangeSize(int shift)
{
   return iHigh(Symbol(), g_tf, shift) - iLow(Symbol(), g_tf, shift);
}

//+------------------------------------------------------------------+
bool IsBullSpike(int shift)
{
   double range = RangeSize(shift);
   if(range <= Point)
      return false;
   double atr = iATR(Symbol(), g_tf, AtrPeriod, shift);
   if(atr <= 0.0)
      return false;
   double body = BodySize(shift);
   double close = iClose(Symbol(), g_tf, shift);
   double open = iOpen(Symbol(), g_tf, shift);
   double low = iLow(Symbol(), g_tf, shift);
   double high = iHigh(Symbol(), g_tf, shift);
   if(close <= open)
      return false;
   if(body < atr * SpikeBodyAtrMin)
      return false;
   if((close - low) / range < SpikeCloseBias)
      return false;
   if((high - close) / range > SpikeShadowMax)
      return false;
   return true;
}

//+------------------------------------------------------------------+
bool IsBearSpike(int shift)
{
   double range = RangeSize(shift);
   if(range <= Point)
      return false;
   double atr = iATR(Symbol(), g_tf, AtrPeriod, shift);
   if(atr <= 0.0)
      return false;
   double body = BodySize(shift);
   double close = iClose(Symbol(), g_tf, shift);
   double open = iOpen(Symbol(), g_tf, shift);
   double low = iLow(Symbol(), g_tf, shift);
   double high = iHigh(Symbol(), g_tf, shift);
   if(close >= open)
      return false;
   if(body < atr * SpikeBodyAtrMin)
      return false;
   if((high - close) / range < SpikeCloseBias)
      return false;
   if((close - low) / range > SpikeShadowMax)
      return false;
   return true;
}

//+------------------------------------------------------------------+
bool IsInsideBar(int motherShift, int childShift)
{
   return (iHigh(Symbol(), g_tf, childShift) <= iHigh(Symbol(), g_tf, motherShift) &&
           iLow(Symbol(), g_tf, childShift)  >= iLow(Symbol(), g_tf, motherShift));
}

//+------------------------------------------------------------------+
bool TrySpikeAt(int s, int &dir, double &spikeBody)
{
   if(IsBullSpike(s))
   {
      dir = 1;
      spikeBody = BodySize(s);
      return true;
   }
   if(IsBearSpike(s))
   {
      dir = -1;
      spikeBody = BodySize(s);
      return true;
   }
   return false;
}

//+------------------------------------------------------------------+
bool TrendAllows(int dir)
{
   if(!UseTrendFilter)
      return true;
   if(iBars(Symbol(), TrendTF) < TrendSlowMA + 5)
      return false;

   double fast = iMA(Symbol(), TrendTF, TrendFastMA, 0, MODE_EMA, PRICE_CLOSE, 1);
   double slow = iMA(Symbol(), TrendTF, TrendSlowMA, 0, MODE_EMA, PRICE_CLOSE, 1);
   if(dir > 0)
      return (fast > slow);
   return (fast < slow);
}

//+------------------------------------------------------------------+
bool PriceAlignsWithTrend(int dir)
{
   if(!RequireTrendPriceAlign || !UseTrendFilter)
      return true;
   if(iBars(Symbol(), TrendTF) < TrendSlowMA + 5)
      return false;
   double slow = iMA(Symbol(), TrendTF, TrendSlowMA, 0, MODE_EMA, PRICE_CLOSE, 1);
   double px = iClose(Symbol(), TrendTF, 1);
   if(dir > 0)
      return (px > slow);
   return (px < slow);
}

//+------------------------------------------------------------------+
bool SetupPassesQuality(int dir, int spikeShift, double entry, double sl, string &reason)
{
   reason = "";
   if(MaxSpikeAgeBars > 0 && spikeShift > MaxSpikeAgeBars)
   {
      reason = "spike too old";
      return false;
   }
   if(!PriceAlignsWithTrend(dir))
   {
      reason = "H1 price vs slow EMA";
      return false;
   }
   if(MinBreakBodyAtr > 0.0)
   {
      double atr = iATR(Symbol(), g_tf, AtrPeriod, 1);
      double o1 = iOpen(Symbol(), g_tf, 1);
      double c1 = iClose(Symbol(), g_tf, 1);
      double body = MathAbs(c1 - o1);
      if(atr <= 0.0 || body < atr * MinBreakBodyAtr)
      {
         reason = "weak break bar body";
         return false;
      }
      if(dir > 0 && c1 <= o1)
      {
         reason = "break bar not bullish";
         return false;
      }
      if(dir < 0 && c1 >= o1)
      {
         reason = "break bar not bearish";
         return false;
      }
   }
   if(MaxSlAtrMultiple > 0.0)
   {
      double atr = iATR(Symbol(), g_tf, AtrPeriod, 1);
      if(atr > 0.0 && MathAbs(entry - sl) > atr * MaxSlAtrMultiple)
      {
         reason = "SL too wide vs ATR";
         return false;
      }
   }
   return true;
}

//+------------------------------------------------------------------+
void ApplyAtrSlFloor(int dir, double entry, double &sl)
{
   if(MinSlAtrMultiple <= 0.0)
      return;
   double atr = iATR(Symbol(), g_tf, AtrPeriod, 1);
   if(atr <= 0.0)
      return;
   double minDist = atr * MinSlAtrMultiple;
   double curDist = MathAbs(entry - sl);
   if(curDist >= minDist)
      return;
   if(dir > 0)
      sl = NormPrice(entry - minDist);
   else
      sl = NormPrice(entry + minDist);
}

//+------------------------------------------------------------------+
bool BuildMicroChannel(int spikeShift, int dir, double spikeBody,
                       int &mcStart, int &mcEnd, double &h1, double &l1)
{
   // After a bullish spike, counter micro-channel is down: lower highs.
   // After a bearish spike, counter micro-channel is up: higher lows.
   bool confirmMode = (EntryMode == MM_H2_CONFIRM || EntryMode == MM_H3_CONFIRM);
   // H2/H3 leave bar 1 for post-MC confirmation bars.
   int walkUntil = confirmMode ? 2 : 1;

   mcStart = spikeShift - 1;
   mcEnd = walkUntil;
   if(mcStart < MicroMinBars)
      return false;

   int len = 0;
   for(int s = mcStart; s >= walkUntil; s--)
   {
      if(BodySize(s) > spikeBody * MicroMaxBodyVsSpike)
         break;
      if(dir > 0)
      {
         // counter down: each high should not rise above prior micro high path
         if(s < mcStart && iHigh(Symbol(), g_tf, s) > iHigh(Symbol(), g_tf, s + 1) + Point)
            break;
      }
      else
      {
         if(s < mcStart && iLow(Symbol(), g_tf, s) < iLow(Symbol(), g_tf, s + 1) - Point)
            break;
      }
      len++;
      mcEnd = s;
      if(len >= MicroMaxBars)
         break;
   }
   if(len < MicroMinBars)
      return false;

   // Classic/inside need a live MC ending on bar 1.
   // H2/H3 need the MC to finish at/before bar 2 so confirmation can print after it.
   if(confirmMode)
   {
      if(mcEnd < 2)
         return false;
   }
   else if(mcEnd != 1)
      return false;

   h1 = iHigh(Symbol(), g_tf, mcEnd);
   l1 = iLow(Symbol(), g_tf, mcEnd);
   for(int i = mcEnd; i <= mcStart; i++)
   {
      if(iHigh(Symbol(), g_tf, i) > h1)
         h1 = iHigh(Symbol(), g_tf, i);
      if(iLow(Symbol(), g_tf, i) < l1)
         l1 = iLow(Symbol(), g_tf, i);
   }

   // Directional sanity: pullback against spike at the MC end
   if(dir > 0)
   {
      if(iClose(Symbol(), g_tf, mcEnd) >= iClose(Symbol(), g_tf, spikeShift))
         return false;
   }
   else
   {
      if(iClose(Symbol(), g_tf, mcEnd) <= iClose(Symbol(), g_tf, spikeShift))
         return false;
   }
   return true;
}

//+------------------------------------------------------------------+
bool ResolveEntryLevels(int dir, int mcStart, int mcEnd, double mcH, double mcL,
                        double &entry, double &sl)
{
   // Prefer inside-bar when mode asks for it or when bar 1 is inside bar 2.
   bool ib = (mcStart >= 2 && IsInsideBar(2, 1));

   if(EntryMode == MM_INSIDE_FIRST && ib)
   {
      if(dir > 0)
      {
         entry = iHigh(Symbol(), g_tf, 1) + BufferDist();
         sl = iLow(Symbol(), g_tf, 1) - BufferDist();
      }
      else
      {
         entry = iLow(Symbol(), g_tf, 1) - BufferDist();
         sl = iHigh(Symbol(), g_tf, 1) + BufferDist();
      }
      return (MathAbs(entry - sl) > Point);
   }

   if(EntryMode == MM_H2_CONFIRM || EntryMode == MM_H3_CONFIRM)
   {
      // H1 = last micro-channel extreme. After MC ends, require 1 (H2) or 2 (H3)
      // newer extremes beyond that level, then enter on the latest one.
      int needBeyondH1 = (EntryMode == MM_H2_CONFIRM) ? 1 : 2;
      double h1Level = (dir > 0) ? iHigh(Symbol(), g_tf, mcEnd) : iLow(Symbol(), g_tf, mcEnd);
      double lastExt = h1Level;
      double trigger = 0.0;
      int confirms = 0;
      for(int s = mcEnd - 1; s >= 1; s--)
      {
         if(dir > 0)
         {
            double h = iHigh(Symbol(), g_tf, s);
            if(h > lastExt + Point)
            {
               confirms++;
               lastExt = h;
               trigger = h;
            }
         }
         else
         {
            double l = iLow(Symbol(), g_tf, s);
            if(l < lastExt - Point)
            {
               confirms++;
               lastExt = l;
               trigger = l;
            }
         }
      }
      if(confirms < needBeyondH1 || trigger <= 0.0)
         return false;
      if(dir > 0)
      {
         entry = trigger + BufferDist();
         sl = mcL - BufferDist();
      }
      else
      {
         entry = trigger - BufferDist();
         sl = mcH + BufferDist();
      }
      return (MathAbs(entry - sl) > Point);
   }

   // Classic EN1: break last micro-channel extreme
   if(dir > 0)
   {
      // Buy stop above last MC high (page: last ceiling H1)
      entry = iHigh(Symbol(), g_tf, 1) + BufferDist();
      sl = mcL - BufferDist();
   }
   else
   {
      entry = iLow(Symbol(), g_tf, 1) - BufferDist();
      sl = mcH + BufferDist();
   }
   return (MathAbs(entry - sl) > Point);
}

//+------------------------------------------------------------------+
void ScanForSetup()
{
   if(!CanOpenNewTradeToday())
   {
      NoteSkip(DailyBlockReason());
      return;
   }
   if(CountMarket() > 0 || CountPending() > 0)
   {
      NoteSkip("already have market/pending");
      return;
   }

   g_scanBars++;
   int spikeShift = -1;
   int dir = 0;
   double spikeBody = 0.0;
   int mcStart = 0;
   int mcEnd = 0;
   double mcH = 0.0;
   double mcL = 0.0;
   bool found = false;
   int spikes = 0;
   int trendBlocks = 0;
   int levelFails = 0;
   int qualityBlocks = 0;
   string qualityReason = "";

   // Prefer the nearest spike with a valid micro-channel (and confirmation if needed).
   for(int s = 1 + MicroMinBars; s <= SpikeLookback; s++)
   {
      int d;
      double body;
      if(!TrySpikeAt(s, d, body))
         continue;
      spikes++;
      if(!TrendAllows(d))
      {
         trendBlocks++;
         continue;
      }
      int start, end;
      double h, l;
      if(!BuildMicroChannel(s, d, body, start, end, h, l))
         continue;

      double entryTry, slTry;
      if(!ResolveEntryLevels(d, start, end, h, l, entryTry, slTry))
      {
         levelFails++;
         continue;
      }
      ApplyAtrSlFloor(d, entryTry, slTry);

      string qReason = "";
      if(!SetupPassesQuality(d, s, entryTry, slTry, qReason))
      {
         qualityBlocks++;
         qualityReason = qReason;
         continue;
      }

      spikeShift = s;
      dir = d;
      spikeBody = body;
      mcStart = start;
      mcEnd = end;
      mcH = h;
      mcL = l;
      g_entryLevel = NormPrice(entryTry);
      g_slLevel = NormPrice(slTry);
      found = true;
      break;
   }
   g_spikeHits += spikes;
   if(!found)
   {
      if(spikes == 0)
         NoteSkip("no spike in lookback");
      else if(trendBlocks >= spikes)
         NoteSkip("spikes blocked by H1 trend filter");
      else if(levelFails > 0)
         NoteSkip("MC found but entry confirmation/levels failed");
      else if(qualityBlocks > 0)
         NoteSkip("quality filter: " + qualityReason);
      else
         NoteSkip("spike found but no valid micro-channel");
      return;
   }
   g_mcHits++;

   g_signals++;
   GlobalVariableSet(Prefix() + "SIG", (double)g_signals);
   g_dir = dir;
   g_attempt = 1;
   g_setupBar = iTime(Symbol(), g_tf, 1);

   Print("MicroMAP setup #", g_signals,
         dir > 0 ? " BUY" : " SELL",
         " spike@", spikeShift,
         " MC=", mcStart, "..", mcEnd,
         " entry=", DoubleToString(g_entryLevel, Digits),
         " SL=", DoubleToString(g_slLevel, Digits));

   if(DrawMarkers)
      MarkSetup(dir, spikeShift, mcStart);

   if(RequireBreakCloseConfirm)
   {
      if(!ArmCloseConfirm(g_dir, g_entryLevel, g_slLevel, g_attempt))
         ResetSetup(false);
      else
         NoteSkip("armed: waiting close beyond break");
   }
   else if(!PlacePending(g_dir, g_entryLevel, g_slLevel, g_attempt))
      ResetSetup(false);
   else
      NoteSkip("pending placed");
}

//+------------------------------------------------------------------+
void MarkSetup(int dir, int spikeShift, int mcStart)
{
   string tag = "MM_" + IntegerToString(MagicNumber) + "_" + IntegerToString((int)TimeCurrent());
   datetime tSpike = iTime(Symbol(), g_tf, spikeShift);
   datetime tMc = iTime(Symbol(), g_tf, 1);
   ObjectCreate(0, tag + "_SP", OBJ_ARROW, 0, tSpike,
                dir > 0 ? iLow(Symbol(), g_tf, spikeShift) : iHigh(Symbol(), g_tf, spikeShift));
   ObjectSetInteger(0, tag + "_SP", OBJPROP_ARROWCODE, dir > 0 ? 233 : 234);
   ObjectSetInteger(0, tag + "_SP", OBJPROP_COLOR, dir > 0 ? clrDodgerBlue : clrOrangeRed);
   ObjectCreate(0, tag + "_MC", OBJ_RECTANGLE, 0, iTime(Symbol(), g_tf, mcStart),
                iHigh(Symbol(), g_tf, mcStart), tMc, iLow(Symbol(), g_tf, 1));
   ObjectSetInteger(0, tag + "_MC", OBJPROP_COLOR, clrDimGray);
   ObjectSetInteger(0, tag + "_MC", OBJPROP_BACK, true);
   ObjectSetInteger(0, tag + "_MC", OBJPROP_FILL, false);
}

//+------------------------------------------------------------------+
double NormalizeLots(double lots)
{
   double minLot = MarketInfo(Symbol(), MODE_MINLOT);
   double maxLot = MarketInfo(Symbol(), MODE_MAXLOT);
   double step = MarketInfo(Symbol(), MODE_LOTSTEP);
   if(step <= 0.0)
      step = minLot;
   if(step <= 0.0)
      return 0.0;
   lots = MathFloor(lots / step + 1e-8) * step;
   int digits = 0;
   double probe = step;
   while(digits < 8 && MathAbs(probe - MathRound(probe)) > 1e-8)
   {
      probe *= 10.0;
      digits++;
   }
   lots = NormalizeDouble(lots, digits);
   if(lots < minLot)
      return 0.0;
   if(lots > maxLot)
      lots = maxLot;
   return lots;
}

//+------------------------------------------------------------------+
double LotForRisk(double slDist)
{
   double tickSize = MarketInfo(Symbol(), MODE_TICKSIZE);
   double tickValue = MarketInfo(Symbol(), MODE_TICKVALUE);
   if(tickSize <= 0.0 || tickValue <= 0.0 || slDist <= 0.0 || g_anchor <= 0.0)
      return 0.0;
   double riskMoney = g_anchor * RiskPercent / 100.0;
   double lossPerLot = (slDist / tickSize) * tickValue;
   if(lossPerLot <= 0.0)
      return 0.0;
   return NormalizeLots(riskMoney / lossPerLot);
}

//+------------------------------------------------------------------+
bool StopsOk(int type, double entry, double sl, double tp)
{
   double minDist = MarketInfo(Symbol(), MODE_STOPLEVEL) * Point;
   if(type == OP_BUY || type == OP_BUYSTOP)
      return (entry - sl >= minDist && tp - entry >= minDist);
   return (sl - entry >= minDist && entry - tp >= minDist);
}

//+------------------------------------------------------------------+
bool PlacePending(int dir, double entry, double sl, int attempt)
{
   if(!CanOpenNewTradeToday())
   {
      NoteSkip(DailyBlockReason());
      return false;
   }
   if(CountMarket() > 0 || CountPending() > 0)
   {
      NoteSkip("already have market/pending");
      return false;
   }
   if(!IsTesting() && !IsExpertEnabled())
   {
      NoteSkip("AutoTrading off");
      Print("MicroMAP skipped: AutoTrading off");
      return false;
   }
   if(!IsTradeAllowed())
   {
      NoteSkip("trading not allowed");
      Print("MicroMAP skipped: trading not allowed");
      return false;
   }

   int spread = ChartSpreadPoints();

   double slDist = MathAbs(entry - sl);
   double minDist = MathMax(MarketInfo(Symbol(), MODE_STOPLEVEL) * Point,
                            spread * Point * MinSlSpreadMultiple);
   if(slDist < minDist)
   {
      NoteSkip("SL too tight vs spread/stopLevel");
      Print("MicroMAP skipped: SL too tight vs spread/stop level");
      return false;
   }

   double lots = LotForRisk(slDist);
   if(lots <= 0.0)
   {
      NoteSkip("lot below broker minimum for risk");
      Print("MicroMAP skipped: lot below broker minimum");
      return false;
   }

   RefreshRates();
   int type;
   double tp;
   if(dir > 0)
   {
      type = OP_BUYSTOP;
      if(entry <= Ask)
         entry = NormPrice(Ask + MathMax(minDist, BufferDist()));
      tp = NormPrice(entry + slDist * RewardRisk);
   }
   else
   {
      type = OP_SELLSTOP;
      if(entry >= Bid)
         entry = NormPrice(Bid - MathMax(minDist, BufferDist()));
      tp = NormPrice(entry - slDist * RewardRisk);
   }
   entry = NormPrice(entry);
   sl = NormPrice(sl);

   if(!StopsOk(type, entry, sl, tp))
   {
      NoteSkip("stops rejected by stop level");
      Print("MicroMAP skipped: stops rejected by stop level");
      return false;
   }

   string comment = "MM EN" + IntegerToString(attempt);
   int ticket = -1;
   for(int a = 0; a < 3; a++)
   {
      RefreshRates();
      ResetLastError();
      ticket = OrderSend(Symbol(), type, lots, entry, SlippagePoints, sl, tp,
                         comment, MagicNumber, 0, dir > 0 ? clrDodgerBlue : clrOrangeRed);
      if(ticket > 0)
         break;
      int err = GetLastError();
      NoteSkip("OrderSend err " + IntegerToString(err));
      Print("MicroMAP OrderSend pending failed. err=", err);
      if(err != 129 && err != 135 && err != 136 && err != 138 && err != 146 && err != 130)
         break;
      Sleep(300);
   }
   if(ticket < 0)
      return false;

   g_pendingTicket = ticket;
   g_entryLevel = entry;
   g_slLevel = sl;
   g_tpLevel = tp;
   g_state = ST_PENDING;
   SaveState();
   Print("MicroMAP pending ", comment, " ticket=", ticket,
         " entry=", DoubleToString(entry, Digits),
         " SL=", DoubleToString(sl, Digits),
         " TP=", DoubleToString(tp, Digits));
   return true;
}

//+------------------------------------------------------------------+
bool ArmCloseConfirm(int dir, double entry, double sl, int attempt)
{
   if(!CanOpenNewTradeToday())
   {
      NoteSkip(DailyBlockReason());
      return false;
   }
   if(CountMarket() > 0 || CountPending() > 0)
   {
      NoteSkip("already have market/pending");
      return false;
   }

   double slDist = MathAbs(entry - sl);
   if(slDist <= Point)
   {
      NoteSkip("invalid SL distance for close-confirm arm");
      return false;
   }

   g_dir = dir;
   g_attempt = attempt;
   g_entryLevel = NormPrice(entry);
   g_slLevel = NormPrice(sl);
   g_breakLevel = (dir > 0) ? NormPrice(entry - BufferDist())
                             : NormPrice(entry + BufferDist());
   g_tpLevel = (dir > 0) ? NormPrice(entry + slDist * RewardRisk)
                         : NormPrice(entry - slDist * RewardRisk);
   g_confirmBarsLeft = ConfirmMaxBars;
   g_state = ST_WAIT_CLOSE;
   SaveState();
   Print("MicroMAP armed close-confirm EN", attempt,
         dir > 0 ? " BUY" : " SELL",
         " break=", DoubleToString(g_breakLevel, Digits),
         " SL=", DoubleToString(g_slLevel, Digits),
         " waitBars=", ConfirmMaxBars);
   return true;
}

//+------------------------------------------------------------------+
void TryCloseConfirmEntry()
{
   if(g_state != ST_WAIT_CLOSE)
      return;
   if(!InEntryWindow() || !CanOpenNewTradeToday())
   {
      NoteSkip(!CanOpenNewTradeToday() ? DailyBlockReason() : "outside entry window");
      ResetSetup(false);
      return;
   }
   if(CancelPendingOnBreak && StructureBroken())
   {
      NoteSkip("close-confirm cancelled: structure broken");
      ResetSetup(false);
      return;
   }

   g_confirmBarsLeft--;
   double cl = iClose(Symbol(), g_tf, 1);
   bool confirmed = false;
   if(g_dir > 0)
      confirmed = (cl > g_breakLevel);
   else if(g_dir < 0)
      confirmed = (cl < g_breakLevel);

   if(confirmed)
   {
      if(!OpenMarketTrade(g_dir, g_slLevel, g_attempt))
         ResetSetup(false);
      return;
   }

   if(g_confirmBarsLeft <= 0)
   {
      NoteSkip("close-confirm expired");
      Print("MicroMAP close-confirm expired without break close");
      ResetSetup(false);
      return;
   }

   NoteSkip("waiting close confirm (" + IntegerToString(g_confirmBarsLeft) + " bars left)");
   SaveState();
}

//+------------------------------------------------------------------+
bool OpenMarketTrade(int dir, double sl, int attempt)
{
   if(!CanOpenNewTradeToday())
   {
      NoteSkip(DailyBlockReason());
      return false;
   }
   if(CountMarket() > 0 || CountPending() > 0)
   {
      NoteSkip("already have market/pending");
      return false;
   }
   if(!IsTesting() && !IsExpertEnabled())
   {
      NoteSkip("AutoTrading off");
      return false;
   }
   if(!IsTradeAllowed())
   {
      NoteSkip("trading not allowed");
      return false;
   }

   RefreshRates();
   int spread = ChartSpreadPoints();
   int type = (dir > 0) ? OP_BUY : OP_SELL;
   double price = (dir > 0) ? Ask : Bid;
   sl = NormPrice(sl);
   double slDist = MathAbs(price - sl);
   double minDist = MathMax(MarketInfo(Symbol(), MODE_STOPLEVEL) * Point,
                            spread * Point * MinSlSpreadMultiple);
   if(slDist < minDist)
   {
      NoteSkip("SL too tight vs spread/stopLevel at market entry");
      return false;
   }

   double lots = LotForRisk(slDist);
   if(lots <= 0.0)
   {
      NoteSkip("lot below broker minimum for risk");
      return false;
   }

   double tp = (dir > 0) ? NormPrice(price + slDist * RewardRisk)
                         : NormPrice(price - slDist * RewardRisk);
   if(!StopsOk(type, price, sl, tp))
   {
      NoteSkip("stops rejected by stop level");
      return false;
   }

   string comment = "MM EN" + IntegerToString(attempt) + "C";
   int ticket = -1;
   for(int a = 0; a < 3; a++)
   {
      RefreshRates();
      price = (dir > 0) ? Ask : Bid;
      slDist = MathAbs(price - sl);
      tp = (dir > 0) ? NormPrice(price + slDist * RewardRisk)
                     : NormPrice(price - slDist * RewardRisk);
      ResetLastError();
      ticket = OrderSend(Symbol(), type, lots, price, SlippagePoints, sl, tp,
                         comment, MagicNumber, 0, dir > 0 ? clrDodgerBlue : clrOrangeRed);
      if(ticket > 0)
         break;
      int err = GetLastError();
      NoteSkip("OrderSend market err " + IntegerToString(err));
      Print("MicroMAP OrderSend market failed. err=", err);
      if(err != 129 && err != 135 && err != 136 && err != 138 && err != 146 && err != 130)
         break;
      Sleep(300);
   }
   if(ticket < 0)
      return false;

   g_tradeTicket = ticket;
   g_pendingTicket = -1;
   g_state = ST_IN_TRADE;
   CaptureOpenedTradeRisk();
   SaveState();
   Print("MicroMAP market entry ", comment, " ticket=", ticket,
         " price=", DoubleToString(price, Digits),
         " SL=", DoubleToString(sl, Digits),
         " TP=", DoubleToString(tp, Digits));
   NoteSkip("market entry after close confirm");
   return true;
}

//+------------------------------------------------------------------+
void CaptureOpenedTradeRisk()
{
   g_beMoved = false;
   g_riskDist = 0.0;
   if(g_tradeTicket <= 0 || !OrderSelect(g_tradeTicket, SELECT_BY_TICKET))
      return;
   if(OrderCloseTime() > 0)
      return;
   double open = OrderOpenPrice();
   double sl = OrderStopLoss();
   if(sl > 0.0)
      g_riskDist = MathAbs(open - sl);
   g_dir = (OrderType() == OP_BUY) ? 1 : -1;
}

//+------------------------------------------------------------------+
void ManageBreakeven()
{
   if(!MoveSlToBreakevenAt1R || g_beMoved)
      return;
   if(g_tradeTicket <= 0 || !OrderSelect(g_tradeTicket, SELECT_BY_TICKET))
      return;
   if(OrderCloseTime() > 0)
      return;

   double open = OrderOpenPrice();
   double sl = OrderStopLoss();
   double tp = OrderTakeProfit();
   double risk = g_riskDist;
   if(risk <= Point && sl > 0.0)
      risk = MathAbs(open - sl);
   if(risk <= Point)
      return;

   RefreshRates();
   bool hit1R = false;
   double newSl = open;
   if(OrderType() == OP_BUY)
   {
      hit1R = (Bid - open >= risk);
      // Keep a tiny offset so BE is not instantly scratched by spread noise.
      newSl = NormPrice(open + Point);
      if(sl > 0.0 && newSl <= sl)
         return;
   }
   else if(OrderType() == OP_SELL)
   {
      hit1R = (open - Ask >= risk);
      newSl = NormPrice(open - Point);
      if(sl > 0.0 && newSl >= sl)
         return;
   }
   else
      return;

   if(!hit1R)
      return;

   double minDist = MarketInfo(Symbol(), MODE_STOPLEVEL) * Point;
   if(OrderType() == OP_BUY && (Bid - newSl) < minDist)
      newSl = NormPrice(Bid - minDist);
   if(OrderType() == OP_SELL && (newSl - Ask) < minDist)
      newSl = NormPrice(Ask + minDist);

   ResetLastError();
   if(!OrderModify(g_tradeTicket, open, newSl, tp, 0, clrGold))
   {
      Print("MicroMAP BE modify failed. err=", GetLastError());
      return;
   }
   g_beMoved = true;
   SaveState();
   Print("MicroMAP SL moved to breakeven. ticket=", g_tradeTicket,
         " newSL=", DoubleToString(newSl, Digits));
   NoteSkip("SL moved to BE at +1R");
}

//+------------------------------------------------------------------+
void ManagePending()
{
   if(g_state != ST_PENDING)
      return;

   // Pending filled?
   if(g_pendingTicket > 0 && OrderSelect(g_pendingTicket, SELECT_BY_TICKET))
   {
      if(OrderCloseTime() == 0 && (OrderType() == OP_BUY || OrderType() == OP_SELL))
      {
         g_tradeTicket = g_pendingTicket;
         g_pendingTicket = -1;
         g_state = ST_IN_TRADE;
         CaptureOpenedTradeRisk();
         SaveState();
         Print("MicroMAP filled ticket=", g_tradeTicket);
         return;
      }
      if(OrderCloseTime() > 0)
      {
         // pending cancelled externally
         g_pendingTicket = -1;
         ResetSetup(false);
         return;
      }
   }

   // Also detect any of our market orders if ticket tracking drifted
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         continue;
      if(!IsOurMarket())
         continue;
      g_tradeTicket = OrderTicket();
      g_pendingTicket = -1;
      g_state = ST_IN_TRADE;
      CaptureOpenedTradeRisk();
      SaveState();
      return;
   }

   if(CancelPendingOnBreak && StructureBroken())
   {
      Print("MicroMAP pending cancelled: structure broken");
      CancelOurPending();
      ResetSetup(false);
   }
}

//+------------------------------------------------------------------+
bool StructureBroken()
{
   if(g_dir == 0)
      return false;
   // If price pushes far through SL side before fill, setup is dead.
   RefreshRates();
   if(g_dir > 0)
      return (Bid < g_slLevel);
   return (Ask > g_slLevel);
}

//+------------------------------------------------------------------+
void ManageOpenTrade()
{
   if(g_state != ST_IN_TRADE && g_state != ST_PENDING)
   {
      // recover if we somehow have a market position
      if(CountMarket() > 0 && g_state == ST_IDLE)
      {
         for(int i = OrdersTotal() - 1; i >= 0; i--)
         {
            if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
               continue;
            if(!IsOurMarket())
               continue;
            g_tradeTicket = OrderTicket();
            g_dir = (OrderType() == OP_BUY) ? 1 : -1;
            g_state = ST_IN_TRADE;
            CaptureOpenedTradeRisk();
            SaveState();
            break;
         }
      }
   }

   if(g_state != ST_IN_TRADE)
      return;

   if(g_tradeTicket > 0 && OrderSelect(g_tradeTicket, SELECT_BY_TICKET))
   {
      if(OrderCloseTime() == 0)
      {
         ManageBreakeven();
         return; // still open
      }

      double pl = OrderProfit() + OrderSwap() + OrderCommission();
      bool stopped = (pl < 0.0);
      Print("MicroMAP closed ticket=", g_tradeTicket, " PL=", DoubleToString(pl, 2),
            stopped ? " STOP" : " TARGET/EXIT");

      g_tradeTicket = -1;
      g_statsOrders = -1; // force stats refresh
      g_statsHistory = -1;

      if(stopped)
         HandleStopOut();
      else
      {
         Print("MicroMAP winning close. winsToday=", WinsClosedToday(),
               " lock=", (!CanOpenNewTradeToday() ? DailyBlockReason() : "open"));
         CancelOurPending();
         ResetSetup(true);
      }
      return;
   }

   // ticket lost: if no market orders remain, treat as closed
   if(CountMarket() == 0)
   {
      g_tradeTicket = -1;
      ResetSetup(false);
   }
}

//+------------------------------------------------------------------+
void HandleStopOut()
{
   if(!CanOpenNewTradeToday())
   {
      NoteSkip(DailyBlockReason());
      InvalidateSetup();
      return;
   }
   if(EntryMode != MM_CLASSIC_CHAIN)
   {
      // confirm modes do not chain retries by design
      InvalidateSetup();
      return;
   }
   if(g_attempt >= MaxAttempts)
   {
      InvalidateSetup();
      return;
   }

   g_attempt++;
   g_waitBar = iTime(Symbol(), g_tf, 0);
   g_state = ST_WAIT_RETRY;
   SaveState();
   Print("MicroMAP waiting for EN", g_attempt, " after stop");
}

//+------------------------------------------------------------------+
void BeginTradeCooldown(int bars)
{
   if(bars <= 0)
   {
      g_state = ST_IDLE;
      g_cooldownUntil = 0;
      return;
   }
   g_state = ST_COOLDOWN;
   g_cooldownUntil = TimeCurrent() + TfToSeconds(g_tf) * bars;
}

//+------------------------------------------------------------------+
void ClearSetupFields()
{
   g_dir = 0;
   g_attempt = 0;
   g_pendingTicket = -1;
   g_tradeTicket = -1;
   g_entryLevel = 0.0;
   g_slLevel = 0.0;
   g_breakLevel = 0.0;
   g_tpLevel = 0.0;
   g_riskDist = 0.0;
   g_beMoved = false;
   g_confirmBarsLeft = 0;
}

//+------------------------------------------------------------------+
void InvalidateSetup()
{
   Print("MicroMAP setup invalidated after ", g_attempt, " stop(s)");
   CancelOurPending();
   int coolBars = (MinBarsBetweenTrades > 0) ? MinBarsBetweenTrades : 3;
   BeginTradeCooldown(coolBars);
   ClearSetupFields();
   SaveState();
}

//+------------------------------------------------------------------+
void ResetSetup(bool afterWin)
{
   // Space entries so the same MicroMAP structure is not re-hit immediately.
   if(afterWin)
      BeginTradeCooldown((MinBarsBetweenTrades > 0) ? MinBarsBetweenTrades : 1);
   else
   {
      g_state = ST_IDLE;
      g_cooldownUntil = 0;
   }
   ClearSetupFields();
   SaveState();
}

//+------------------------------------------------------------------+
int TfToSeconds(ENUM_TIMEFRAMES tf)
{
   switch(tf)
   {
      case PERIOD_M1:  return 60;
      case PERIOD_M5:  return 300;
      case PERIOD_M15: return 900;
      case PERIOD_M30: return 1800;
      case PERIOD_H1:  return 3600;
      case PERIOD_H4:  return 14400;
      case PERIOD_D1:  return 86400;
   }
   return 300;
}

//+------------------------------------------------------------------+
void TryPlaceRetry()
{
   if(g_state != ST_WAIT_RETRY)
      return;
   if(!InEntryWindow() || !CanOpenNewTradeToday())
   {
      if(!CanOpenNewTradeToday())
      {
         NoteSkip(DailyBlockReason());
         CancelOurPending();
         ResetSetup(false);
      }
      return;
   }
   if(CountMarket() > 0 || CountPending() > 0)
      return;

   // Wait for at least one new closed candle after the stop
   datetime bar1 = iTime(Symbol(), g_tf, 1);
   if(bar1 <= 0 || bar1 <= g_waitBar)
      return;

   double entry, sl;
   if(g_dir > 0)
   {
      entry = iHigh(Symbol(), g_tf, 1) + BufferDist();
      // EN2: SL at newest lowest low; EN3: SL at that candle low (page)
      if(g_attempt >= 3)
         sl = iLow(Symbol(), g_tf, 1) - BufferDist();
      else
         sl = MathMin(iLow(Symbol(), g_tf, 1), iLow(Symbol(), g_tf, 2)) - BufferDist();
   }
   else
   {
      entry = iLow(Symbol(), g_tf, 1) - BufferDist();
      if(g_attempt >= 3)
         sl = iHigh(Symbol(), g_tf, 1) + BufferDist();
      else
         sl = MathMax(iHigh(Symbol(), g_tf, 1), iHigh(Symbol(), g_tf, 2)) + BufferDist();
   }

   g_entryLevel = NormPrice(entry);
   g_slLevel = NormPrice(sl);
   g_signals++;
   GlobalVariableSet(Prefix() + "SIG", (double)g_signals);

   if(!PlacePending(g_dir, g_entryLevel, g_slLevel, g_attempt))
   {
      // if cannot place, invalidate rather than loop forever
      InvalidateSetup();
   }
}

//+------------------------------------------------------------------+
void CancelOurPending()
{
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         continue;
      if(!IsOurPending())
         continue;
      int ticket = OrderTicket();
      if(!OrderDelete(ticket))
         Print("MicroMAP OrderDelete failed. ticket=", ticket, " err=", GetLastError());
   }
   g_pendingTicket = -1;
}

//+------------------------------------------------------------------+
void CloseOurPositions()
{
   if(CountMarket() == 0)
      return;
   if(TimeCurrent() - g_lastCloseTry < 5)
      return;
   g_lastCloseTry = TimeCurrent();

   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         continue;
      if(!IsOurMarket())
         continue;
      int ticket = OrderTicket();
      double lots = OrderLots();
      int type = OrderType();
      RefreshRates();
      double price = (type == OP_BUY) ? Bid : Ask;
      if(!OrderClose(ticket, lots, price, SlippagePoints, clrNONE))
         Print("MicroMAP session close failed. ticket=", ticket, " err=", GetLastError());
   }
}

//+------------------------------------------------------------------+
string StateName()
{
   switch(g_state)
   {
      case ST_IDLE:        return "idle";
      case ST_PENDING:     return "pending EN" + IntegerToString(g_attempt);
      case ST_IN_TRADE:    return "in trade EN" + IntegerToString(g_attempt);
      case ST_WAIT_RETRY:  return "wait EN" + IntegerToString(g_attempt);
      case ST_WAIT_CLOSE:  return "wait close confirm EN" + IntegerToString(g_attempt);
      case ST_COOLDOWN:    return "cooldown/invalid";
   }
   return "?";
}

//+------------------------------------------------------------------+
string StatusText()
{
   if(!CanOpenNewTradeToday())
      return DailyBlockReason();
   if(MustBeFlat() || !InEntryWindow())
      return "outside entry window";
   return StateName();
}

//+------------------------------------------------------------------+
void Panel()
{
   int spread = ChartSpreadPoints();
   Comment("MicroMAP  ", StatusText(),
           "\nChart TF=", IntegerToString((int)g_tf),
           "  chart spread=", IntegerToString(spread), " pt",
           "\nCloseConfirm=", (RequireBreakCloseConfirm ? "ON" : "off"),
           "  BE@1R=", (MoveSlToBreakevenAt1R ? "ON" : "off"),
           "  quality: align=", (RequireTrendPriceAlign ? "on" : "off"),
           " breakATR=", DoubleToString(MinBreakBodyAtr, 2),
           " spikeAge=", MaxSpikeAgeBars,
           " maxSlATR=", DoubleToString(MaxSlAtrMultiple, 2),
           "  BE moved=", (g_beMoved ? "yes" : "no"),
           "\nLast skip: ", g_lastSkip,
           "\nScanned bars: ", IntegerToString(g_scanBars),
           "  spike hits: ", IntegerToString(g_spikeHits),
           "  MC hits: ", IntegerToString(g_mcHits),
           "\nDay net: ", DoubleToString(TodayClosedNet(), 2),
           "    wins: ", IntegerToString(WinsClosedToday()),
           " / max ", IntegerToString(MaxWinsPerDay),
           "\nSignals today: ", IntegerToString(g_signals),
           "    trades opened today: ", IntegerToString(TradesOpenedToday()),
           " / ", IntegerToString(MaxTradesPerDay),
           "    open: ", IntegerToString(CountMarket()),
           " pending: ", IntegerToString(CountPending()),
           "\nLocks: profit+", DoubleToString(DailyProfitLockR, 1), "R",
           " loss-", DoubleToString(DailyLossLockR, 1), "R",
           " coolBars=", IntegerToString(MinBarsBetweenTrades));
}
//+------------------------------------------------------------------+
