# FORGE Tactical Fitness — Privacy Policy

**Last updated: 4 May 2026**

## 1. Who we are

FORGE Tactical Fitness ("FORGE", "we", "us") is operated by Leo Wemyss. Contact: leowemyss@icloud.com

---

## 2. What data we collect

### 2.1 Data you provide
| Data | Purpose |
|------|---------|
| Email address | Account creation and sign-in (optional cloud sync) |
| Password | Authentication (hashed by Supabase; we never see it) |
| Training sessions (type, duration, score, RPE, load) | Core app function — tracking fitness progress |
| Readiness logs (sleep, soreness, stress, hydration, resting HR, HRV) | Recovery monitoring |
| Body weight | Ruck score calculation |
| Squad member records | Instructor/coach feature for managing a team |

### 2.2 GPS location
FORGE requests location access **only** when you start a GPS ruck-tracking session. Location data is:
- Collected as latitude/longitude track points while the session is active
- Stored locally on your device
- Synced to your cloud account if you have signed in
- **Never** shared with third parties or used for advertising

Background location is used only to continue recording your route while the app is not in the foreground during an active ruck session. You are warned when background tracking is active (via the foreground service notification on Android).

### 2.3 Automatically collected data
We do **not** collect analytics, crash reports, device identifiers, or advertising data.

---

## 3. How we use your data

- To display your training history and readiness metrics inside the app
- To sync your data across devices via your Supabase account
- To calculate ruck scores and readiness bands

We do not use your data for advertising, profiling, or any purpose beyond operating the app.

---

## 4. Data storage and security

| Storage | What | Where |
|---------|------|-------|
| Local device | All sessions, members, readiness logs | AsyncStorage (device only) |
| Keychain / Keystore | App lock PIN | expo-secure-store (encrypted OS keychain) |
| Cloud (Supabase) | Sessions and squad members if you sign in | Supabase-hosted PostgreSQL (EU/US region) |

Cloud data is protected by row-level security — you can only read and write your own records. Supabase encrypts data in transit (TLS) and at rest.

---

## 5. Data retention

- **Local data** is retained until you delete the app or use the OPSEC Wipe function.
- **Cloud data** is retained while your account is active. You can request deletion by emailing leowemyss@icloud.com.

---

## 6. Third-party services

| Service | Purpose | Privacy Policy |
|---------|---------|----------------|
| Supabase | Authentication and cloud sync | https://supabase.com/privacy |

We have no other third-party integrations. There are no advertising SDKs, analytics SDKs, or social login providers in the app.

---

## 7. Children

FORGE is intended for adults. We do not knowingly collect data from anyone under 16.

---

## 8. Your rights

You may at any time:
- **Export** all your data using the Export function in Coach › Settings
- **Delete** all local data using the OPSEC Wipe function
- **Request account deletion** by emailing leowemyss@icloud.com — we will delete your cloud data within 30 days

---

## 9. Changes to this policy

We will update this document when our practices change. The "Last updated" date at the top will reflect the most recent revision.

---

## 10. Contact

For any privacy questions: **leowemyss@icloud.com**
