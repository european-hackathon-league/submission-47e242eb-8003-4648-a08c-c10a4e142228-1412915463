# Demo evidence files

Synthetic files for demonstrating **Add your own evidence** on the setup page. Every row is invented for the demo; none of it is BMW data. Inside the app it is always shown as **Your data**.

Use with **BMW 5 Series · G60** and **United States**.

| File | Choose type | What it shows |
| --- | --- | --- |
| `1-customer-feedback.csv` | Customer feedback | 8 comments. Three have an empty feature column, so the preview shows auto-matching. |
| `2-market-data.csv` | Market data | 4 rows: dealer survey, benchmark, order mix, service data. |
| `3-global-trends.csv` | Global trend | 3 trends expected by launch. |
| `4-past-decisions.csv` | Past decision | 2 approved decisions (add a memory bonus) and 1 rejected decision (flagged as a caution, no points). |

## Suggested demo flow

1. Generate once without uploads. In **Exterior & Utility**, *Panorama glass roof* sits at **#10** with a *Limited customer signal* caveat.
2. Upload the four files (weight 8 works well), checking the preview each time.
3. Generate again. The roof moves up the ranking, its card shows **Includes your data**, and the reasoning has a **Based on evidence you added** section listing what each upload contributed.
4. Open **Touch screen, operation** in **Digital Experience & Controls**: the rejected 2021 decision appears as a caution ("No points added. Check whether that reason still holds.").
5. Remove the uploads from the list on the setup page to reset.
