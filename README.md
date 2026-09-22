Open a terminal window and open a type in the following

/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Desktop/amex-chrome"

Then make sure you log in and go to the offers page.
Put it in grid view.

Then in a new terminal window type in the following:

cd ~/Desktop/amex-playwright

Then type in:

node amex-playwright.js
