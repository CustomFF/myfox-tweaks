# Changelog

## 160.0 — 2026-10-27

- about:myfox has a Profiles section with MyFox 1.2.1 or newer: MyFox's profiles, when each was last used, launching one in a window of its own, putting the tweaks into one; making one the default, a new profile or an import from another Firefox as a command to run with Firefox closed
- The "Advanced settings" and "Add bookmarklets" bookmarks go to the end of the bookmarks toolbar, after the bookmarks already there (an imported profile's)

## 159.10 — 2026-10-23

- DNS over HTTPS through Cloudflare is on from the first start, in the "Increased protection" mode (it falls back to the system's DNS); MyFox can leave it off, and it's an ordinary Firefox setting afterwards

## 159.9 — 2026-10-22

- about:addons lines up with the settings: in a narrow window its page starts as close to the navigation, its search field is level with the navigation's logo, its page heading at the settings' height; its first section starts where the settings' first card does

## 159.8 — 2026-10-22

- about:logins looks like the settings: the page and its cards in the settings' colors; the list of logins a card, its rows plates with the selected one filled quietly instead of a bar at the start
- about:logins' login is a card laid out as a form, labels in a column before the values; the fields of its add and edit form are like the pages' other fields, the hint beside the address like a tooltip, its ... menu like the window's menus
- about:logins' list starts level with the login's card, its rows denser, 2px apart; a login with an alert is tinted, a breached site red, a vulnerable password or no username orange; the breach alert is a quiet tint instead of a framed red block
- The sidebar password card's alerts: the row's label in the warning color, a breached site's in red, and the alert bar a row of the card with a quiet tint (red for a breach) instead of a full-width block; the alerts view's messages are quiet tints too
- The passwords sidebar's ... menu has "Remove found passwords (N)…" while something is searched for: it removes the logins found, after a confirmation
- The passwords sidebar's ... menu has "Select several": the cards get checkboxes, a bar above the list says how many are selected, with Select all, Clear selection and Remove (after a confirmation)
- While something is searched for, the passwords sidebar says how many logins were found

## 159.7 — 2026-10-22

- Checkbox and radio items of menus have the small flat checkboxes and radio buttons of the browser's pages instead of the system's large framed ones
- Menus cast a deeper shadow, all round, so one opened from a panel (the translation offer's settings) no longer merges into it
- The drop-downs of the window's panels (the translation panels, the site's HTTPS-Only setting, the camera, microphone and screen prompts) have no outline, as the drop-downs of the browser's pages
- Drop-down lists of the browser's pages (the settings' menus, about:addons' gear menu, the search engine picker) look like the menus: rows edge to edge, no frame, the menus' shadow; a drop-down is no longer framed while hovered or open
- Checkboxes and radio buttons of the window's panels and of the older dialogs (Page Info) are small and flat, as in the browser's pages, instead of the system's
- The edit-bookmark panel's folder drop-down is like the other drop-downs: the button's fill, no outline
- Trees (the edit-bookmark panel's folders, the Library, Page Info) have no dotted frame round the current row
- The selected row of those trees is lit with a quiet fill instead of the system's accent
- Text fields of the Library and the other older windows are 26px high with the small corner radius and a quiet border, instead of Nova's rounded ones
- The Library's toolbar takes the window's colors instead of the system's title bar ones, which made a light strip at the top of a dark window
- The Library and Page Info are light or dark with the browser's theme, not with the system's
- Under a MyFox theme the Library and Page Info take the theme's colors (the Library's folders the sidebar's, Page Info's sections a tab strip), and their fields, buttons and lists the controls' look, with no frames
- The sidebar's buttons start under the first buttons of the navigation and bookmarks toolbars, in a column beside the sidebar or in a row above it, with horizontal or vertical tabs alike
- View > Sidebar has radio items instead of checkboxes: one panel shows at a time
- The bookmarks toolbar button's tooltip says "Show bookmarks toolbar" or "Hide bookmarks toolbar", in Firefox's own words and language
- The bookmarks toolbar button has a new icon, outlined like the other toolbar icons, instead of a filled one
- The sidebar and bookmarks toolbar buttons, while on, have a quieter fill, brighter under the pointer
- The about:config bookmark on the bookmarks toolbar has an icon of tools instead of the gear, which the sidebar's customize button has too
- Tooltips all look alike, Firefox's own ones for toolbar buttons too: the theme's sidebar colors with a quiet frame, the menu text size, instead of the system's colors, frame and font
- Text fields of the browser's pages and panels (settings, the passwords' add form, the sidebar's search boxes) are filled, 26px high with the small radius, and show an accent frame when focused; newer Firefox had left them with Nova's rounded, framed look
- Every text field has the same quiet frame (a fifth of the text color): the find bar, the bookmark panel, the Library, the downloads and translations panels, the pages' fields
- The settings' boxes have no frames: a row on its own is a filled plate, a group one filled plate with plain rows
- The settings' file types table reads as a table: a header row of its own fill, two columns of different fills, the action menus centered, a darker row under the pointer
- The website appearance tiles in the settings look like about:myfox's: no frame but the chosen one's 2px accent one, and rounder
- The settings' search engine and website language lists are denser, their rows separate plates 2px apart
- Keyboard focus shows on round close buttons and the settings' menu: the ring is inside a close button, square on a menu item instead of a pill, and double on the selected item, the accent outside and the item's text color inside
- A password card in the sidebar is a small form: short labels (Site, User, Password) in a column aligned on their colons, the values after them, no site icon, the site as plain text instead of a link, the rows closer together
- The password card's rows are no longer buttons: each row has its own buttons, shown while the pointer is on it (or the keyboard's focus in it): open and copy for the site (the full address), copy for the username, show and copy for the password; the card and the row under the pointer are lit
- Editing a password is a pencil in the card's top-left corner, shown while the pointer is on the card, instead of a full-width Edit button under the password

## 159.6 — 2026-10-19

- System integration on about:myfox: switching on tells afterwards where another `firefox` was kept; with MyFox 1.1.20 or newer, switching off asks whether to restore it, and the switch can't be turned on while there is nowhere to keep it

## 159.5 — 2026-10-19

- about:myfox's Settings have "Appearance": light or dark, a small picture of each, switching both the MyFox theme and the websites' appearance; under another theme neither is chosen
- about:myfox has Settings with "System integration": with MyFox 1.1.18 or newer, a switch for whether the `firefox` command in a terminal and in scripts opens the Firefox MyFox installed

## 159.4 — 2026-10-19

- about:myfox links to the bookmarklets' and the userscripts' repositories
- The Help menus have "About MyFox tweaks" next to "About Firefox", opening about:myfox
- about:myfox has the cat for its tab icon, black on a light theme and white on a dark one
- Titles of horizontal tabs are centered again; a recent Firefox had pinned them to the start
- On/off switches are smaller (24×12) and flat: no frame, a gray track when off, the accent when on
- Checkboxes and radio buttons in the browser's own pages match the switches: small and flat, gray when off, the accent when on
- The look of buttons, fields, switches, checkboxes and radio buttons comes with the MyFox themes only: under another theme they are Firefox's own
- The form fields' autocomplete menu is shaped like the other menus: items edge to edge, square, the chosen one lit with a quiet fill instead of an accent frame; it keeps the page's light or dark colors

## 159.3 — 2026-10-16

- about:myfox: a page of the tweaks' own, with the installed version and the full changelog

## 159.2 — 2026-10-16

- The new tab page's weather widget has a square-cornered location field, not a pill
- The extensions (puzzle) panel has a button next to "Manage extensions" that opens the extensions sidebar panel
- A row of the extensions panel lights up as a whole under the pointer, edge to edge, its "..." button too
- Context menus and the bookmarks menus take the theme's colors and a quiet highlight, as the panels have, instead of the system's colors and accent; items of menus and panels run edge to edge
- The downloads panel is as compact as the other menus: downloads are rows edge to edge, not cards, lit as a whole under the pointer, with a square folder button
- The downloads sidebar panel looks like the downloads panel: square rows edge to edge, a quiet highlight instead of the system's accent, and larger file icons
- In the downloads sidebar panel, Tab and Shift+Tab step from one download to the next, with the focus ring on the selected one
- The downloads panel's "Show all downloads" opens the downloads sidebar panel instead of the Library window
- The downloads sidebar panel's context menu takes the theme's colors, as the other menus do
- In the tab strip a tab group is a card in its color, rounded like a tab with an ear at each end: its tabs sit in it a little lower, down to the strip's edge, tinted with its color, with no line under them; the ears of the group and of the tabs next to it no longer mix
- The bookmarks sidebar panel's tree has no dotted frame round its current row
- On a dark theme the sidebar is a little darker, so menus opened over it stand out
- The settings and "Add-ons and themes" pages have the MyFox themes' grays instead of Firefox's violet-tinged ones, light or dark as the website appearance setting says

## 159.1 — 2026-10-15

- With vertical tabs and the sidebar expanded, pinned tabs are tabs in a row, not tiles: the selected one (or the last) a full tab joined to the page, the others their icons before it
- A pinned tab has a small pin at its icon's corner that unpins it on click; it shows under the pointer, and always in the collapsed vertical tab strip, and grows while the tab is under the pointer
- Pinned tabs in a row fade toward the selected one as background tabs in the tab strip do
- With vertical tabs collapsed to icons, pinned tabs are rows as the other tabs are, only the selected tab has ears, and the splitter below the pinned tabs looks like a thin selected tab with a grip and can be dragged again
- In the tab strip, background tabs fade from transparent beside the selected tab to the selected tab's color, half see-through, at their outer side (pinned ones a little brighter), over a strip the color of the address field, a little darker
- A background tab under the pointer is solid, a touch apart from the selected tab's color, and shows both its curved feet over its neighbors
- The tab strip has no shadows any more: none around the selected tab, between background tabs or from the navigation bar
- Vertical tabs in the background fade diagonally from transparent at their corner toward the selected tab, by the page, to the selected tab's color, over a column the color of the tab strip, with no shadows or shading; one under the pointer is solid and shows both its curved feet
- On light themes the tab strip and the vertical tab column are a little darker
- A split view's pair of tabs has no backing or shadows of its own: in the background it fades across both halves as one tab does, and selected, both halves are the selected tab's color, the other half no longer dimmed
- Hovering a tab group's label recolors the whole group, not only the label, in the tab strip and in the vertical tab column
- With vertical tabs collapsed to icons, every tab of a group has the group's line along its side, not only the selected one, and the group's background tabs are half see-through
- The container line on background tabs is stronger, on dark and light themes alike
- With vertical tabs collapsed to icons, the selected split view pair joins the page with no gap, its other half is a little darker than the selected one, and the halves cast a soft shadow on the column

## 159.0 — 2026-10-13

- On light themes the container colors show: a thicker, stronger line on container tabs and a stronger tint of the window
- The selected tab's shadow on light themes is tighter
- A tab under the pointer shows more clearly on light themes
- The navigation bar casts a soft shadow onto the tabs behind it
- Background tabs overlap like cards stacked toward the selected tab, each with a curved foot on its outer side and, on light themes, a soft shadow; hovering only recolors a tab
- Vertical tabs span the whole tab column and stack like cards toward the selected tab, as horizontal ones do
- The vertical tab column is a little darker on light themes, the window casts a soft shadow onto it, and the selected vertical tab has a soft shadow on light themes
- Background tabs darken toward the edge tucked under the next card; the strip behind horizontal tabs is a shade darker, and the vertical tab column takes the color of a tab under its neighbor's shadow
- On dark themes too the selected tab and the stacked background tabs cast soft shadows
- The tabs' whole look (shape, size, cards, shadows, container colors, vertical tabs) applies only with the MyFox themes; under any other theme tabs look as Firefox draws them
- Background tabs take the toolbar's shadow along their bottom edge too, half as deep, which gives them thickness
- In split view the two pages are cards with a narrow gap between them, and the active one has a thin accent frame
- A split view's two tabs are one tab card with a thin divider, and the selected half has a bold title; tabs next to a split view or a tab group stack toward the selected tab correctly
- With vertical tabs a split view's two tabs are one card as well, one above the other with a thin line between them
- Hovering either tab of a split view lights up the whole pair, the other tab a little less
- A split view's tab sits lower than other tabs (with vertical tabs, in from the column's edge), on a strip in the tab bar's color, with no shadow, so it can't be mistaken for a container tab; each half takes its own container's color, and the window around each page is tinted by its own container, split at the splitter
- With vertical tabs and the sidebar expanded, tab icons sit half as far from the tab's edge
- Tab groups have a label of a tab's shape with the group's name and a solid shelf in the group's color under their tabs, which are a little narrower than others; a collapsed group shows the number of its tabs on the label
- With the tab column on the right, a tab's close button is on its other side
- With the sidebar collapsed to icons the selected tab reaches the page, with no strip of the column showing along its side
- With vertical tabs a split view in the background takes the window's shadow along its side and casts a soft shadow on its neighbor, as other tabs do; in the selected split view the faded tab's ears are faded too
- With the sidebar collapsed to icons a split view spans the column like other tabs, its icons nearer the middle, with a short dash between them and the window's shadow along its side
- With vertical tabs a tab group is a tree in its color: the group's name on a bar across the column with a + or − to collapse or open it, its tabs hanging from a trunk; a collapsed group shows the number of its tabs, +N while one of them is selected. With the sidebar collapsed to icons the group is a block in its color, the selected tab on its own card edged in it
- On dark themes background tabs are a touch lighter than the toolbar
- Horizontal tabs show their titles in the middle of the tab

## 158.2 — 2026-10-09

- Keyboard focus is shown as the same thin accent border everywhere, the address bar included
- The pills and circles left from Firefox's redesign are gone: the find bar, the new-tab page, about:config, about:translations, the window buttons, history rows and the badges in the address bar all use the same small corner radius
- Address bar suggestions and the search-engine menu run the full width of their dropdowns, the menu's icons lined up with the engine button
- The translation offer panel is more compact
- Container tabs: instead of a straight line across the rounded tab, a line in the container color follows the top of horizontal tabs round their corners, vertical tabs fade in from the color at their outer side, and a selected container tab tints the whole window
- Vertical tabs are part of the window like horizontal ones: they run to the edge of their column, the selected one flows into the window with curved corners, and the column lines up with the page
- Tabs sit right against each other, with no gap between them
- Tab previews cast a lighter shadow
- The "..." button of an extension in the Extensions panel has rounded corners and sits closer to the edge
- In a new profile, back, forward and reload sit around the address bar

## 158.1 — 2026-10-08

- After a tweaks update MyFox can restart a running Firefox to apply it, with the open tabs restored

## 158.0 — 2026-10-06

- First release of the tweaks as a separate download, so they can be updated on their own
