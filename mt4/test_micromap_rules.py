#!/usr/bin/env python3
"""Structural sanity checks for MicroMAP detection rules (mirrors EA logic)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Bar:
    o: float
    h: float
    l: float
    c: float

    @property
    def body(self) -> float:
        return abs(self.c - self.o)

    @property
    def range(self) -> float:
        return self.h - self.l


def is_bull_spike(b: Bar, atr: float, body_atr_min=1.2, close_bias=0.70, shadow_max=0.30) -> bool:
    if b.range <= 0 or atr <= 0 or b.c <= b.o:
        return False
    if b.body < atr * body_atr_min:
        return False
    if (b.c - b.l) / b.range < close_bias:
        return False
    if (b.h - b.c) / b.range > shadow_max:
        return False
    return True


def is_bear_spike(b: Bar, atr: float, body_atr_min=1.2, close_bias=0.70, shadow_max=0.30) -> bool:
    if b.range <= 0 or atr <= 0 or b.c >= b.o:
        return False
    if b.body < atr * body_atr_min:
        return False
    if (b.h - b.c) / b.range < close_bias:
        return False
    if (b.c - b.l) / b.range > shadow_max:
        return False
    return True


def build_bull_mc(spike: Bar, mc: list[Bar], max_body_vs_spike=0.70) -> tuple[float, float] | None:
    """Counter-down micro-channel after bullish spike: non-rising highs, small bodies."""
    if len(mc) < 2:
        return None
    if mc[-1].c >= spike.c:
        return None
    for i, b in enumerate(mc):
        if b.body > spike.body * max_body_vs_spike:
            return None
        if i > 0 and b.h > mc[i - 1].h:
            return None
    h1 = max(b.h for b in mc)
    l1 = min(b.l for b in mc)
    entry = mc[-1].h  # classic EN1: break last ceiling
    sl = l1
    return entry, sl


def build_bear_mc(spike: Bar, mc: list[Bar], max_body_vs_spike=0.70) -> tuple[float, float] | None:
    if len(mc) < 2:
        return None
    if mc[-1].c <= spike.c:
        return None
    for i, b in enumerate(mc):
        if b.body > spike.body * max_body_vs_spike:
            return None
        if i > 0 and b.l < mc[i - 1].l:
            return None
    h1 = max(b.h for b in mc)
    l1 = min(b.l for b in mc)
    entry = mc[-1].l
    sl = h1
    return entry, sl


def expectancy(p_win: float, reward: float, risk: float = 1.0) -> float:
    return p_win * reward - (1.0 - p_win) * risk


def MaxTradesPerDay_default() -> int:
    return 5


def stop_after_first_win_blocks_second_entry(enabled: bool, had_win: bool) -> bool:
    if enabled and had_win:
        return False
    return True


def trades_limit_blocks(opened: int, max_trades: int) -> bool:
    return opened >= max_trades


def wins_limit_blocks(wins: int, max_wins: int, stop_after_first: bool) -> bool:
    if stop_after_first and wins >= 1:
        return True
    if max_wins > 0 and wins >= max_wins:
        return True
    return False


def r_lock_blocks(day_net: float, day_loss: float, one_r: float, profit_lock_r: float, loss_lock_r: float) -> bool:
    if one_r <= 0:
        return False
    if profit_lock_r > 0 and day_net >= profit_lock_r * one_r:
        return True
    if loss_lock_r > 0 and day_loss >= loss_lock_r * one_r:
        return True
    return False


def can_open_new_trade(
    opened: int,
    max_trades: int,
    wins: int,
    max_wins: int,
    stop_after_first: bool,
    day_net: float,
    day_loss: float,
    one_r: float,
    profit_lock_r: float,
    loss_lock_r: float,
) -> bool:
    if wins_limit_blocks(wins, max_wins, stop_after_first):
        return False
    if r_lock_blocks(day_net, day_loss, one_r, profit_lock_r, loss_lock_r):
        return False
    if trades_limit_blocks(opened, max_trades):
        return False
    return True


def main() -> None:
    atr = 10.0
    spike = Bar(100, 120, 99, 119)  # strong bull close near high
    assert is_bull_spike(spike, atr), "bull spike should detect"
    assert not is_bear_spike(spike, atr)

    # Compressing lower-high pullback
    mc = [
        Bar(118, 118.5, 114, 115),
        Bar(115, 116.0, 112, 113),
        Bar(113, 114.0, 110, 111),
    ]
    levels = build_bull_mc(spike, mc)
    assert levels is not None, "micro-channel should form"
    entry, sl = levels
    assert entry == 114.0
    assert sl == 110.0
    rr = 3.0
    tp = entry + (entry - sl) * rr
    assert tp == 126.0

    # Rising highs breaks micro-channel
    bad = [
        Bar(118, 118.5, 114, 115),
        Bar(115, 119.0, 112, 113),  # higher high
    ]
    assert build_bull_mc(spike, bad) is None

    bear = Bar(120, 121, 100, 101)
    assert is_bear_spike(bear, atr)
    bear_mc = [
        Bar(102, 106, 101.5, 105),
        Bar(105, 108, 104.0, 107),
        Bar(107, 110, 106.5, 109),
    ]
    bl = build_bear_mc(bear, bear_mc)
    assert bl is not None
    b_entry, b_sl = bl
    assert b_entry == 106.5
    assert b_sl == 110.0

    # Daily capacity defaults for 3-5 trades/day mode
    assert MaxTradesPerDay_default() == 5
    assert stop_after_first_win_blocks_second_entry(True, had_win=True) is False
    assert stop_after_first_win_blocks_second_entry(False, had_win=True) is True
    assert trades_limit_blocks(opened=5, max_trades=5) is True
    assert trades_limit_blocks(opened=3, max_trades=5) is False

    # Multi-trade day: allow more entries until win/R locks
    assert can_open_new_trade(
        opened=2, max_trades=5, wins=1, max_wins=3, stop_after_first=False,
        day_net=50.0, day_loss=20.0, one_r=50.0, profit_lock_r=4.0, loss_lock_r=3.0,
    )
    assert not can_open_new_trade(
        opened=2, max_trades=5, wins=3, max_wins=3, stop_after_first=False,
        day_net=50.0, day_loss=20.0, one_r=50.0, profit_lock_r=4.0, loss_lock_r=3.0,
    )
    assert not can_open_new_trade(
        opened=1, max_trades=5, wins=1, max_wins=3, stop_after_first=False,
        day_net=200.0, day_loss=0.0, one_r=50.0, profit_lock_r=4.0, loss_lock_r=3.0,
    )
    assert not can_open_new_trade(
        opened=2, max_trades=5, wins=0, max_wins=3, stop_after_first=False,
        day_net=-40.0, day_loss=150.0, one_r=50.0, profit_lock_r=4.0, loss_lock_r=3.0,
    )

    # Expectancy examples still valid mathematically
    e = expectancy(0.40, 2.0)  # 40% win @ 2R
    assert abs(e - 0.2) < 1e-9, e
    e3 = expectancy(0.30, 3.0)  # optional higher-RR profile
    assert abs(e3 - 0.2) < 1e-9, e3

    print("PASS: spike detection")
    print("PASS: bull micro-channel EN1 entry/SL")
    print("PASS: bear micro-channel EN1 entry/SL")
    print("PASS: invalid rising-high pullback rejected")
    print("PASS: daily multi-trade capacity and R-lock rules")
    print("PASS: expectancy at 40% win / 2R = +0.20R")
    print("PASS: expectancy at 30% win / 3R = +0.20R")
    print("ALL MicroMAP structural checks passed")


if __name__ == "__main__":
    main()
