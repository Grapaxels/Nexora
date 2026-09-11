# Nexora role-based sidebars

The API now returns an explicit `role` value: `user`, `admin`, or `superadmin`.

## User sidebar
- Marketplace
- Campus Pulse
- Free finds
- Want to buy
- Semester-end
- Offline arcade
- Messages
- Saved items
- My listings

## Admin sidebar
Admins get an **ADMINISTRATION** section. Links are shown only when the admin has the matching permission:
- Overview
- Users (users/verification permission)
- Reports (reports permission)
- Content (listings permission)

They also retain the normal campus and personal navigation.

## Super Admin sidebar
Super admins get a **SUPER ADMIN** section:
- Overview
- Users
- Reports
- Content
- Admin access

They also retain the normal campus and personal navigation.

`ADMIN_EMAILS` entries are treated as full admins. Users assigned permissions by the Super Admin are treated as admins. `SUPER_ADMIN_EMAIL` remains the super-admin account.
