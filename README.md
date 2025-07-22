# 🏋️‍♂️ FitTrackJS – Fitness Tracking System

FitTrackJS is a backend API designed to manage users' fitness progress, track workouts, nutrition, and provide performance analytics. It allows users to log daily exercises, track their diet, and view progress over time. The backend is built with Node.js and uses JSON mock data to simulate a real database, focusing on user-friendly interfaces, data validation, and providing actionable fitness insights.

---

## 📁 Project Structure


```
FitTrackJS/
├── app.js
├── server.js
├── package.json
├── data/
│ ├── users.json
│ ├── workouts.json
│ ├── nutritionLogs.json
│ ├── socialShares.json
│ ├── scheduledShares.json
│ ├── notifications.json
│ └── notificationQueue.json
├── models/
│ ├── userModel.js
│ ├── connectorModel.js
│ ├── workoutModel.js
│ ├── nutritionModel.js
│ ├── socialShareModel.js
│ └── notificationModel.js
├── controllers/
│ ├── authController.js
│ ├── workoutController.js
│ ├── nutritionController.js
│ ├── socialShareController.js
│ └── notificationController.js
├── routes/
│ ├── analyticsRoutes.js
│ ├── authRoutes.js
│ ├── adminRoutes.js
│ ├── connectorRoutes.js
│ ├── fitnessGoalRoutes.js
│ ├── workoutRoutes.js
│ ├── nutritionRoutes.js
│ ├── socialShareRoutes.js
│ ├── stravaConnectorRoutes.js
│ └── notificationRoutes.js
├── utils/
│ ├── fileUtils.js
│ ├── fileService.js
│ ├── validation.js
│ ├── errorUtils.js
│ ├── auditLogUtils.js
│ ├── transactionUtils.js
│ ├── websocketService.js
│ ├── shareWebsocketService.js
│ ├── schedulerQueue.js
│ ├── notificationQueueService.js
│ └── createResourceService.js
├── services/
│ ├── socialMediaPublisher.js
│ ├── notificationProcessor.js
│ ├── emailService.js
│ └── inactivityAlertService.js
├── scripts/
│ ├── processScheduledShares.js
│ ├── setupScheduler.js
│ ├── processScheduledNotifications.js
│ ├── processInactivityAlerts.js
│ └── recoverTransactions.js
└── tests/
├── integration/
│ ├── analyticsEndpoints.test.js
│ ├── socialShareApi.test.js
│ ├── scheduledShareE2E.test.js
│ └── notificationE2E.test.js
└── helpers/
└── notificationTestHelper.js
```

---

## ⚙️ How to Run

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start the server**

   ```bash
   npm run dev
   ```

3. **Run test**

   ```bash
   npm test
   ```

---

## 🔍 Key Highlights

| # | Module                                     | Status      | Key Features                                                                                                |
| - | ------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------- |
| 1 | User Management API                        | ✅ Completed | Full CRUD for user profiles with input validation for email & password, JSON-file persistence               |
| 2 | Workout Log API                            | ✅ Completed | Track different exercise types (cardio, weightlifting, flexibility), including duration and calories burned |
| 3 | Nutrition Tracking API                     | ✅ Completed | Logs meals, calories, macros (carbs, protein, fats), and validates meal type and nutritional values         |
| 4 | Fitness Goal API                           | ✅ Completed | Track fitness goals such as weight loss and strength, calculate progress towards goal, CRUD operations      |
| 5 | Performance Analytics API                  | ✅ Completed | Aggregate workout and nutrition data, calculate calories burned, total workouts, and goal progress          |
| 6 | Social Sharing API                         | ✅ Completed | Allow users to share fitness achievements, workout summaries, and goal progress on social media platforms   |
| 7 | Notification & Reminder API                | ✅ Completed | Schedule workout reminders, goal check-ins, inactivity alerts, and background job processing                |
| 8 | Third-Party Fitness Device Integration API | ✅ Completed | Connect to platforms like Strava and Fitbit, OAuth flow, and sync workout data into the system              |

---

## 🧪 Unit Test Results & 🚀 Code Execution Screenshots

| Conversation | Test Result Screenshot                                                    | Code Execution Screenshot                                                 |
| --| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1 | [View](https://drive.google.com/file/d/1oMaS5x63j2gshhcQqrVdFODHhT9u3521/view?usp=drive_link) | [View](https://drive.google.com/file/d/1vymixV7VPuiSVs9TYAUaDIrp1o8A6Vd8/view?usp=drive_link) |
| 2 | [View](https://drive.google.com/file/d/1eOcs3SWDHS3zybClO9WEJF-Di9YEoPgT/view?usp=drive_link) | [View](https://drive.google.com/file/d/1dKXClVLy5OyqXxmsmw2Lu2YUSOkQzUS9/view?usp=drive_link) |
| 3 | [View](https://drive.google.com/file/d/1SyzgJCuhyff9pI9E48xEoyGQb03BSp6r/view?usp=drive_link) | [View](https://drive.google.com/file/d/1tBqUqRmhDDC10H9ScYBd0MyckmZiftDA/view?usp=drive_link) |
| 4 | [View](https://drive.google.com/file/d/1dmlPxqGSbkpPyssf11MOl_52m5uWYmX0/view?usp=drive_link) | [View](https://drive.google.com/file/d/1S6WBQp6mKHyDJ9ALYlYqUHMblXcTu8Gh/view?usp=drive_link) |
| 5 | [View](https://drive.google.com/file/d/1m4Xo8ELlm6jLV6i9tPhjQK2TFfJiFwaK/view?usp=drive_link) | [View](https://drive.google.com/file/d/1223mjen1AtieocvsqdEN--uWN3oIrtcO/view?usp=drive_link) |
| 6 | [View](https://drive.google.com/file/d/1rcQWxwhsgz6KAXeg4T3sdAQLFLGhpoos/view?usp=drive_link) | [View](https://drive.google.com/file/d/1K0F2w_TVlSkh-isFx_2bleWp_Pdmh8JF/view?usp=drive_link) |
| 7 | [View](https://drive.google.com/file/d/1yDBuLV-RG9aEzS3-SVOaLojihVahzRTn/view?usp=drive_link) | [View](https://drive.google.com/file/d/1u6enRRPqW9S4m_blUNGeESALhyQGvu6m/view?usp=drive_link) |
| 8 | [View](https://drive.google.com/file/d/1dRUQrdBk2576LdkE6aewUW-VfmBmag9D/view?usp=drive_link) | [View](https://drive.google.com/file/d/1zJ_SePqUql3-LQhwfliK_VLPmnB0azkR/view?usp=drive_link) |

---

## 📦 Dependencies

See [`package.json`](./package.json) for the full list.
Key dependencies include:

* **express** – HTTP server framework
* **body-parser** – JSON payload parsing
* **jest** & **supertest** – Testing framework & HTTP assertions
* **nodemon** (dev) – Dev auto-reload

---
