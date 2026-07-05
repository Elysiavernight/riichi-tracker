🀄 Riichi Mahjong Score Tracker

This project is made for the Elysiavernight team's riichi mahjong games.

This project aims to reduce the hurdle needed when playing riichi mahjong physically by calculating points and tracking rounds digitally.

the score, actions like Rons, Tsumo, Riichi will all be tracked via a mobile app


### 1. Ron Payout Base Table
| Han Count | Non-Dealer Pay (From Loser) | Dealer Pay (From Loser) |
| :--- | :--- | :--- |
| **1 Han** | 1,000 pts | 2,000 pts |
| **2 Han** | 2,000 pts | 3,000 pts |
| **3 Han** | 6,000 pts | 7,700 pts |
| **4 Han** | 7,000 pts | 11,600 pts |
| **5 Han (Mangan)** | 8,000 pts | 12,000 pts |
| **6–7 Han (Haneman)** | 12,000 pts | 18,000 pts |
| **8–10 Han (Baiman)** | 18,000 pts | 24,000 pts |
| **11–12 Han (Sanbaiman)**| 24,000 pts | 36,000 pts |
| **13+ Han (Yakuman)** | 32,000 pts $\times$ Multiplier | 48,000 pts $\times$ Multiplier |

### 2. Tsumo Split Mechanics
Because calculations are handled digitally, **exact point division** is supported with clean `100`-point precision intervals across players, ignoring standard physical stick rounding rules:
* **Dealer Tsumo:** All 3 non-dealers split the target base point value + Honba penalty equally ($1/3$ each).
* **Non-Dealer Tsumo:** The Dealer pays exactly $1/2$ of the total hand value, while the other two non-dealers split the remaining $1/2$ ($1/4$ each). Honba values are distributed uniformly.

