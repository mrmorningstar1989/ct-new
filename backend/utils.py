"""Business day and other helpers."""
from datetime import date, timedelta


def fifth_business_day(year: int, month: int) -> date:
    """Return the 5th business day (Mon-Fri) of a given month."""
    d = date(year, month, 1)
    count = 0
    while True:
        if d.weekday() < 5:  # 0=Mon..4=Fri
            count += 1
            if count == 5:
                return d
        d += timedelta(days=1)


def month_end(year: int, month: int) -> date:
    """Last day of the given month."""
    from calendar import monthrange
    _, last = monthrange(year, month)
    return date(year, month, last)
