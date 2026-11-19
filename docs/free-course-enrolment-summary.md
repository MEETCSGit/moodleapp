# Free course enrolment in the IRClass Academy app

Date: 2026-11-19
Branches: app `irclass-academy-moodle-app`, website `feature/app-free-enrol`

## Problem in the app

- Tapping **Enrol for free** opened the website in the in-app browser, even though a free course needs no payment.
- On courses that also have Moodle self enrolment (for example course 46), the app first asked: "Self enrolment" or "Complete enrolment in browser". Choosing self enrolment skips the course registration form.

## Problem on the website side

- IRClass free courses are enrolled by IRClass commerce through the website page `local/irclass_commerce/free.php`. That page:
  1. checks that the course is free,
  2. shows the course registration form first when the course needs it,
  3. enrols the learner,
  4. saves the free enrolment record and sends the welcome email and notification.
- `free.php` is a browser form. There is no web service the app can call to do the same.
- The app can only enrol learners inside the app through Moodle self enrolment. Most free courses do not have it (for example PFSO, course 12), and it bypasses the registration form, the free enrolment record and the emails.

## Option considered: Moodle self enrolment for free courses

It works in the app without code changes, but:

- the registration form is not checked, so learners are blocked by the course gate later;
- no commerce free enrolment record, no My orders entry, no welcome email or notification;
- the course loses the "Free" label and is missing from the Free price filter in the website and app catalogue;
- the website enrolment page changes for web users too;
- every free course needs extra setup.

Not recommended.

## Agreed solution

### Website (`local_irclass_commerce`)

New web service `local_irclass_commerce_enrol_free`. It does exactly what `free.php` does: the same checks, the same enrolment, record and emails. The website behaviour does not change.

| Result | Meaning |
|---|---|
| `enrolled` | The learner is enrolled (or already was). |
| `registration` | The registration form must be completed first. Its address is returned. |
| `paid` | The course is sold, not free. Use checkout. |
| `refused` | Enrolment is not possible. A message explains why. |

Files:

- `public/local/irclass_commerce/classes/external/enrol_free.php` (new)
- `public/local/irclass_commerce/db/services.php` (new)
- `public/local/irclass_commerce/version.php` (version 2026111902)

### App (course summary page)

**Enrol for free**:

- No registration form needed: the learner is enrolled inside the app and the course opens. No browser.
- Registration form needed: only the form opens in the in-app browser. After submitting it, the learner comes back to the course.
- Site without the new service: the previous website flow is used.

**Buy this course** (paid courses) is unchanged: the in-app browser is used only for checkout and payment.

For courses sold by IRClass commerce, the app no longer offers the Moodle self enrolment choice.

## Status

| Part | Status |
|---|---|
| Website service | Written and checked on the local site (a course that is not free is refused and nobody is enrolled). Not committed or pushed. |
| App | Written; lint and type check pass. Not committed. |
| Live test | Pending. |

## Next steps

1. Deploy the 3 website files to live.
2. Run `php admin/cli/upgrade.php` and purge caches.
3. Test in the app on live:
   - a free course without the registration form: enrolled inside the app;
   - a free course with the registration form: the form opens, then the course;
   - a paid course: checkout opens as before.
4. Commit and push the app change.

## Related website clean-up (optional)

Course 46 ("Course restoration in progress") has Moodle self enrolment enabled as well as IRClass commerce. On the website, self enrolment still lets people join without the registration form. Disable it in *Course › Participants › Enrolment methods* if it is not intended.
