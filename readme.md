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

## What's included in V1
1. Login/Register authentication features
2. Creating private rooms to play with friends
3. joining with room ID
4. East/South games
5. Points tracking including Yakuman(up to sextuple yakuman)

## what should be expected in the future 
1. An option for 3 player mahjong(v.1.1.0)
2. An option to customize the app to your liking(v.2.0.0)
## Disclaimer

im aware this app maybe not perfect, this app is aimed to be use by me and my other close friends when playing Riichi mahjong to reduce the hurdle of having to setup sticks and tracking placement after the game.

## Tech stack
This app is built with Expo+React native for the mobile app and fastify for the backend server. both of which are new stack to me.


## Installing

To use this app on your mobile phone, navigate to the releases section and download the provided apk.