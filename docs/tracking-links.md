# Tracking links: which posts and messages bring signups

BOB remembers the first link a visitor clicked (in their browser) and attaches it to the account when they sign up.
You see it in **Admin > Overview > "Where signups come from"** and in the **Source** column on Customers.

How to use it: add `?utm_source=...&utm_medium=...&utm_campaign=...` to the link you share. Lowercase, no spaces.
- `utm_source` = the place (linkedin, instagram, text, email, facebook-group)
- `utm_medium` = the kind (social, dm, post, outreach)
- `utm_campaign` = the push (founding75)

A person who clicks a link on one device and signs up on another still counts, because the source also travels with
their account. If someone types getbob.agency directly (or the link had no tags), they show as "direct / unknown".
Links from another site with no tags (for example an Instagram bio) are labelled automatically (instagram, facebook, linkedin, google).

## Ready-to-use links (homepage)

| Where you share it | Link |
|---|---|
| LinkedIn post | https://getbob.agency/?utm_source=linkedin&utm_medium=social&utm_campaign=founding75 |
| Instagram bio / stories | https://getbob.agency/?utm_source=instagram&utm_medium=social&utm_campaign=founding75 |
| Facebook group post | https://getbob.agency/?utm_source=facebook&utm_medium=group&utm_campaign=founding75 |
| Personal text / DM | https://getbob.agency/?utm_source=text&utm_medium=dm&utm_campaign=founding75 |
| Personal email | https://getbob.agency/?utm_source=email&utm_medium=outreach&utm_campaign=founding75 |
| Agency owners / IMO leaders | https://getbob.agency/?utm_source=imo&utm_medium=outreach&utm_campaign=founding75 |

## Tour links with tags (the tour page passes the tag along to signup)

- Solo tour: https://getbob.agency/demo.html?utm_source=linkedin&utm_medium=social&utm_campaign=founding75
- Agency tour: https://getbob.agency/demo.html?mode=agency&utm_source=imo&utm_medium=outreach&utm_campaign=founding75

Change `utm_source` to match where you post it. Don't put a person's name or any private detail in a link.
