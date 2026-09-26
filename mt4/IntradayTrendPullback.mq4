//+------------------------------------------------------------------+
//| IntradayTrendPullback.mq4                                        |
//| One open position. Fixed percent risk. Reward larger than risk.  |
//| Stops new trades when gross closed profit or gross closed loss    |
//| reaches its own daily cap.                                        |
//|                                                                  |
//| Breakeven win rate at reward:risk 1.6 is about 38.5% before      |
//| spread and slippage. Measure that in the Strategy Tester.        |
//| Daily caps limit a finished day. They do not create an edge.     |
//+------------------------------------------------------------------+
#property copyright "Intraday trend pullback"
#property link      ""
#property version   "1.00"
#property strict
#property description "M5 pullback in the H1 trend. One position at a time."
#property description "Stops for the day when closed profit or loss reaches its cap."

input int    MagicNumber             = 260922;
input double RiskPercent             = 0.5;    // risk per trade, percent of day-start balance
input double DailyProfitCapPercent   = 1.5;    // stop new trades after this closed-day gain
input double DailyLossCapPercent     = 1.5;    // stop new trades after this closed-day loss
input double RewardRisk              = 1.6;    // take-profit distance / stop distance
input int    AtrPeriod               = 14;
input double AtrMultiplier           = 1.2;    // stop distance = ATR * this
input int    FastMA                  = 8;      // signal EMA on the signal timeframe
input int    TrendFastMA             = 34;     // trend EMA
input int    TrendSlowMA             = 89;
input int    RsiPeriod               = 14;
input ENUM_TIMEFRAMES SignalTF       = PERIOD_M5;
input ENUM_TIMEFRAMES TrendTF        = PERIOD_H1;
input int    StartHour               = 8;      // broker server time
input int    EndHour                 = 20;
input int    FridayStopHour          = 20;
input int    MinMinutesBeforeClose   = 60;     // no new trade this close to the session end
input int    MinBarsBetweenEntries   = 3;
input bool   CloseAtSessionEnd       = true;
input bool   FlatBeforeWeekend       = true;
input bool   TradeOnSunday           = false;
input int    MaxSpreadPoints         = 30;
input int    SlippagePoints          = 30;
input double MinSlSpreadMultiple     = 3.0;    // stop must be at least this many spreads wide

double   g_anchor  = 0.0;
int      g_signals = 0;
datetime g_lastCloseTry = 0;
datetime g_statsDay = 0;
int      g_statsOrders = -1;
int      g_statsHistory = -1;
double   g_statsGrossProfit = 0.0;
double   g_statsGrossLoss = 0.0;
int      g_statsTrades = 0;

//+------------------------------------------------------------------+
int OnInit()
{
   if(RiskPercent <= 0.0 || DailyProfitCapPercent <= 0.0 || DailyLossCapPercent <= 0.0)
      return INIT_PARAMETERS_INCORRECT;
   if(RewardRisk <= 0.0 || AtrPeriod < 1 || AtrMultiplier <= 0.0 || FastMA < 1)
      return INIT_PARAMETERS_INCORRECT;
   if(TrendFastMA < 1 || TrendSlowMA <= TrendFastMA || RsiPeriod < 2)
      return INIT_PARAMETERS_INCORRECT;
   if(StartHour < 0 || StartHour > 23 || EndHour < 1 || EndHour > 24 || StartHour >= EndHour)
      return INIT_PARAMETERS_INCORRECT;
   if(FridayStopHour < 0 || FridayStopHour > 24 || MinMinutesBeforeClose < 0)
      return INIT_PARAMETERS_INCORRECT;
   if(MaxSpreadPoints < 0 || SlippagePoints < 0 || MinSlSpreadMultiple <= 0.0)
      return INIT_PARAMETERS_INCORRECT;

   if(IsTesting())
   {
      GlobalVariableDel(Prefix() + "DAY");
      GlobalVariableDel(Prefix() + "BAL");
      GlobalVariableDel(Prefix() + "SIG");
      GlobalVariableDel(Prefix() + "BAR");
   }

   double oneFullWin = RiskPercent * RewardRisk;
   if(DailyProfitCapPercent <= oneFullWin)
      Print("ITP warning: profit cap is at or below one full winner, so one win can end the day.");
   if(DailyLossCapPercent <= RiskPercent)
      Print("ITP warning: loss cap is at or below one full loss, so one loss can end the day.");

   Print("ITP started. Risk=", DoubleToString(RiskPercent, 2),
         "%  RR=", DoubleToString(RewardRisk, 2),
         "  profit cap=", DoubleToString(DailyProfitCapPercent, 2),
         "%  loss cap=", DoubleToString(DailyLossCapPercent, 2), "%");
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Comment("");
}

//+------------------------------------------------------------------+
void OnTick()
{
   if(iTime(Symbol(), PERIOD_D1, 0) <= 0)
      return;
   if(iBars(Symbol(), SignalTF) < 100)
      return;
   if(iBars(Symbol(), TrendTF) < TrendSlowMA + 5)
      return;

   SyncDay();
   if(MustBeFlat())
      CloseOurPositions();

   datetime closedBar = iTime(Symbol(), SignalTF, 1);
   if(closedBar <= 0 || IsTradeContextBusy() || BarHandled(closedBar))
   {
      Panel();
      return;
   }

   MarkBar(closedBar);
   TryEntry();
   Panel();
}

//+------------------------------------------------------------------+
string Prefix()
{
   string head = IsTesting() ? "ITPT_" : "ITP_";
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
int TfSeconds(ENUM_TIMEFRAMES tf)
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
bool IsOurMarketOrder()
{
   if(OrderSymbol() != Symbol() || OrderMagicNumber() != MagicNumber)
      return false;
   return (OrderType() == OP_BUY || OrderType() == OP_SELL);
}

//+------------------------------------------------------------------+
int CountPositions()
{
   int n = 0;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         continue;
      if(IsOurMarketOrder())
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

   for(int i = orders - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         continue;
      if(!IsOurMarketOrder())
         continue;
      if(OrderOpenTime() >= day)
         g_statsTrades++;
   }
   for(int j = history - 1; j >= 0; j--)
   {
      if(!OrderSelect(j, SELECT_BY_POS, MODE_HISTORY))
         continue;
      if(!IsOurMarketOrder())
         continue;
      if(OrderOpenTime() >= day)
         g_statsTrades++;
      if(OrderCloseTime() < day)
         continue;
      double pl = OrderProfit() + OrderSwap() + OrderCommission();
      if(pl > 0.0)
         g_statsGrossProfit += pl;
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
double TodayGrossProfit()
{
   RefreshDayStats();
   return g_statsGrossProfit;
}

//+------------------------------------------------------------------+
double TodayGrossLoss()
{
   RefreshDayStats();
   return g_statsGrossLoss;
}

//+------------------------------------------------------------------+
int TradesOpenedToday()
{
   RefreshDayStats();
   return g_statsTrades;
}

//+------------------------------------------------------------------+
bool ProfitCapHit()
{
   if(g_anchor <= 0.0)
      return true;
   double cap = g_anchor * DailyProfitCapPercent / 100.0;
   return (TodayGrossProfit() >= cap);
}

//+------------------------------------------------------------------+
bool LossCapHit()
{
   if(g_anchor <= 0.0)
      return true;
   double cap = g_anchor * DailyLossCapPercent / 100.0;
   return (TodayGrossLoss() >= cap);
}

//+------------------------------------------------------------------+
bool BullTrend()
{
   double fast = iMA(Symbol(), TrendTF, TrendFastMA, 0, MODE_EMA, PRICE_CLOSE, 1);
   double slow = iMA(Symbol(), TrendTF, TrendSlowMA, 0, MODE_EMA, PRICE_CLOSE, 1);
   return (fast > slow);
}

//+------------------------------------------------------------------+
bool BearTrend()
{
   double fast = iMA(Symbol(), TrendTF, TrendFastMA, 0, MODE_EMA, PRICE_CLOSE, 1);
   double slow = iMA(Symbol(), TrendTF, TrendSlowMA, 0, MODE_EMA, PRICE_CLOSE, 1);
   return (fast < slow);
}

//+------------------------------------------------------------------+
bool EmaReclaim(bool buy)
{
   double ema = iMA(Symbol(), SignalTF, FastMA, 0, MODE_EMA, PRICE_CLOSE, 1);
   double hi = iHigh(Symbol(), SignalTF, 1);
   double lo = iLow(Symbol(), SignalTF, 1);
   double cl = iClose(Symbol(), SignalTF, 1);
   double op = iOpen(Symbol(), SignalTF, 1);
   double spreadDist = MarketInfo(Symbol(), MODE_SPREAD) * Point;
   if((hi - lo) < spreadDist)
      return false;

   if(buy)
   {
      if(!(lo <= ema && cl > ema && cl > op))
         return false;
   }
   else
   {
      if(!(hi >= ema && cl < ema && cl < op))
         return false;
   }

   for(int s = 2; s <= 4; s++)
   {
      double emaS = iMA(Symbol(), SignalTF, FastMA, 0, MODE_EMA, PRICE_CLOSE, s);
      double clS = iClose(Symbol(), SignalTF, s);
      if(buy && clS < emaS)
         return true;
      if(!buy && clS > emaS)
         return true;
   }
   return false;
}

//+------------------------------------------------------------------+
bool RsiReturn(bool buy)
{
   double rsi1 = iRSI(Symbol(), SignalTF, RsiPeriod, PRICE_CLOSE, 1);
   double rsi2 = iRSI(Symbol(), SignalTF, RsiPeriod, PRICE_CLOSE, 2);
   double cl = iClose(Symbol(), SignalTF, 1);
   double op = iOpen(Symbol(), SignalTF, 1);
   if(buy)
      return (rsi2 < 45.0 && rsi1 >= 50.0 && cl > op);
   return (rsi2 > 55.0 && rsi1 <= 50.0 && cl < op);
}

//+------------------------------------------------------------------+
int SignalDirection()
{
   bool up = BullTrend();
   bool down = BearTrend();
   if(up == down)
      return 0;
   if(up && (EmaReclaim(true) || RsiReturn(true)))
      return 1;
   if(down && (EmaReclaim(false) || RsiReturn(false)))
      return -1;
   return 0;
}

//+------------------------------------------------------------------+
datetime LastExitTime()
{
   datetime last = 0;
   for(int i = OrdersHistoryTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_HISTORY))
         continue;
      if(!IsOurMarketOrder())
         continue;
      if(OrderCloseTime() > last)
         last = OrderCloseTime();
   }
   return last;
}

//+------------------------------------------------------------------+
bool InCooldown()
{
   if(MinBarsBetweenEntries <= 0)
      return false;
   datetime last = LastExitTime();
   if(last <= 0)
      return false;
   int wait = MinBarsBetweenEntries * TfSeconds(SignalTF);
   return (TimeCurrent() - last < wait);
}

//+------------------------------------------------------------------+
void AddSignal()
{
   g_signals++;
   GlobalVariableSet(Prefix() + "SIG", (double)g_signals);
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
double NormPrice(double price)
{
   return NormalizeDouble(price, Digits);
}

//+------------------------------------------------------------------+
bool StopsLookValid(int type, double entry, double sl, double tp)
{
   double minDist = MarketInfo(Symbol(), MODE_STOPLEVEL) * Point;
   if(type == OP_BUY)
      return (entry - sl >= minDist && tp - entry >= minDist);
   return (sl - entry >= minDist && entry - tp >= minDist);
}

//+------------------------------------------------------------------+
void TryEntry()
{
   if(!InEntryWindow())
      return;
   if(ProfitCapHit() || LossCapHit())
      return;

   int dir = SignalDirection();
   if(dir == 0)
      return;

   AddSignal();
   Print("ITP signal #", g_signals, dir > 0 ? " BUY" : " SELL");

   if(CountPositions() > 0)
   {
      Print("ITP signal skipped: a position is already open");
      return;
   }
   if(!IsTesting() && !IsExpertEnabled())
   {
      Print("ITP signal skipped: AutoTrading is off");
      return;
   }
   if(!IsTradeAllowed())
   {
      Print("ITP signal skipped: trading is not allowed");
      return;
   }

   int spread = (int)MarketInfo(Symbol(), MODE_SPREAD);
   if(spread > MaxSpreadPoints)
   {
      Print("ITP signal skipped: spread ", spread, " > ", MaxSpreadPoints);
      return;
   }
   if(InCooldown())
   {
      Print("ITP signal skipped: waiting after the previous trade");
      return;
   }

   double atr = iATR(Symbol(), SignalTF, AtrPeriod, 1);
   double slDist = atr * AtrMultiplier;
   double spreadDist = spread * Point;
   double stopLevelDist = MarketInfo(Symbol(), MODE_STOPLEVEL) * Point;
   double minDist = MathMax(stopLevelDist, spreadDist * MinSlSpreadMultiple);
   if(atr <= 0.0 || slDist < minDist)
   {
      Print("ITP signal skipped: stop distance is too small for this spread");
      return;
   }

   double lots = LotForRisk(slDist);
   if(lots <= 0.0)
   {
      Print("ITP signal skipped: risk budget is below the broker minimum lot");
      return;
   }

   OpenTrade(dir, lots, slDist);
}

//+------------------------------------------------------------------+
void OpenTrade(int dir, double lots, double slDist)
{
   if(CountPositions() > 0)
      return;

   int type = (dir > 0) ? OP_BUY : OP_SELL;
   int ticket = -1;
   for(int attempt = 0; attempt < 3; attempt++)
   {
      RefreshRates();
      double price = (type == OP_BUY) ? Ask : Bid;
      ticket = OrderSend(Symbol(), type, lots, price, SlippagePoints, 0, 0,
                          "ITP", MagicNumber, 0, type == OP_BUY ? clrBlue : clrRed);
      if(ticket > 0)
         break;
      int err = GetLastError();
      Print("ITP OrderSend failed. err=", err);
      if(err != 129 && err != 135 && err != 136 && err != 138 && err != 146)
         break;
      Sleep(400);
   }

   if(ticket < 0)
      return;
   if(!ApplyStops(ticket, type, slDist))
   {
      Print("ITP stop placement failed. Closing unprotected ticket ", ticket);
      EmergencyClose(ticket);
   }
}

//+------------------------------------------------------------------+
bool ApplyStops(int ticket, int type, double slDist)
{
   for(int attempt = 0; attempt < 3; attempt++)
   {
      if(!OrderSelect(ticket, SELECT_BY_TICKET))
         return false;
      if(OrderCloseTime() > 0)
         return false;

      double entry = OrderOpenPrice();
      double sl;
      double tp;
      if(type == OP_BUY)
      {
         sl = NormPrice(entry - slDist);
         tp = NormPrice(entry + slDist * RewardRisk);
      }
      else
      {
         sl = NormPrice(entry + slDist);
         tp = NormPrice(entry - slDist * RewardRisk);
      }
      if(!StopsLookValid(type, entry, sl, tp))
      {
         Print("ITP stops rejected by broker minimum distance");
         return false;
      }

      ResetLastError();
      if(OrderModify(ticket, OrderOpenPrice(), sl, tp, 0, clrNONE))
      {
         if(!OrderSelect(ticket, SELECT_BY_TICKET))
            return false;
         if(OrderStopLoss() > 0.0 && OrderTakeProfit() > 0.0)
            return true;
      }
      Print("ITP OrderModify failed. err=", GetLastError());
      Sleep(300);
      RefreshRates();
   }
   return false;
}

//+------------------------------------------------------------------+
void EmergencyClose(int ticket)
{
   for(int attempt = 0; attempt < 5; attempt++)
   {
      if(!OrderSelect(ticket, SELECT_BY_TICKET))
         return;
      if(OrderCloseTime() > 0)
         return;
      RefreshRates();
      double price = (OrderType() == OP_BUY) ? Bid : Ask;
      if(OrderClose(ticket, OrderLots(), price, SlippagePoints, clrRed))
         return;
      Print("ITP emergency close failed. err=", GetLastError());
      Sleep(400);
   }
}

//+------------------------------------------------------------------+
void CloseOurPositions()
{
   if(CountPositions() == 0)
      return;
   if(TimeCurrent() - g_lastCloseTry < 5)
      return;
   g_lastCloseTry = TimeCurrent();

   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
         continue;
      if(!IsOurMarketOrder())
         continue;
      int ticket = OrderTicket();
      double lots = OrderLots();
      int type = OrderType();
      RefreshRates();
      double price = (type == OP_BUY) ? Bid : Ask;
      if(!OrderClose(ticket, lots, price, SlippagePoints, clrNONE))
         Print("ITP session close failed. ticket=", ticket, " err=", GetLastError());
   }
}

//+------------------------------------------------------------------+
string StatusText()
{
   if(LossCapHit())
      return "stopped: daily loss cap";
   if(ProfitCapHit())
      return "stopped: daily profit cap";
   if(MustBeFlat() || !InEntryWindow())
      return "outside entry window";
   if(CountPositions() > 0)
      return "position open";
   return "ready";
}

//+------------------------------------------------------------------+
void Panel()
{
   double profitCap = g_anchor * DailyProfitCapPercent / 100.0;
   double lossCap = g_anchor * DailyLossCapPercent / 100.0;
   Comment("ITP  ", StatusText(),
           "\nGross profit: ", DoubleToString(TodayGrossProfit(), 2),
           " / ", DoubleToString(profitCap, 2),
           "    gross loss: ", DoubleToString(TodayGrossLoss(), 2),
           " / ", DoubleToString(lossCap, 2),
           "\nSignals today: ", IntegerToString(g_signals),
           "    trades opened today: ", IntegerToString(TradesOpenedToday()),
           "    open positions: ", IntegerToString(CountPositions()));
}
//+------------------------------------------------------------------+
