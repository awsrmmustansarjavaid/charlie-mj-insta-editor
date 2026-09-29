/**
 * app.js — application entry point.
 *
 * Creates the initial (empty) state and starts the UI once the page has loaded.
 * All real work happens in the modules loaded before this file (see the
 * <script> order in index.html).
 */
window.CMJ = window.CMJ || {};

document.addEventListener('DOMContentLoaded', function () {
  CMJ.state = CMJ.State.create();   // empty state until the user opens a photo
  CMJ.ui.init();                    // build controls, wire events, draw the empty screen
});
