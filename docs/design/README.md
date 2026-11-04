# Design reference

`screens/` holds the final approved screens from the design canvas as `.dc.html` files. They are **reference, not code to copy**: they run on the canvas runtime, not in Next.js.

Use them to read exact copy, layout, spacing, colours (CSS variables at the top of each file), states and interactions (the `renderVals()` logic at the bottom shows what each screen does).

| File | Screen |
|---|---|
| `S1Hero.dc.html` | Landing: header + hero |
| `S2Features.dc.html` | Landing: what's inside |
| `S3Rest.dc.html` | Landing: how it works, Noor, FAQ, CTA, footer |
| `SignUp.dc.html`, `LogIn.dc.html` | Auth |
| `AppOnboard.dc.html` | Onboarding (4 steps) |
| `AppHome.dc.html` | Home |
| `AppPeople.dc.html` | People + profile panel |
| `AppCalendar.dc.html` | Calendar |
| `AppWishlists.dc.html` | Wishlists (mine + friends') |
| `AppCelebrate.dc.html` | Celebrate Me |
| `AppProfile.dc.html` | My profile |
| `AppSettings.dc.html` | Settings |

Mobile screens will be designed later; until then, make each desktop screen responsive using the design system rules.
