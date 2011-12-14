// Copyright (c) 2011 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview VT100 test suite.
 *
 * This is more of an integration test suite for the VT100 and Terminal classes,
 * as each test typically sends strings into the VT100 parser and then reads
 * the terminal to verify that everyone did the right thing.
 */

hterm.VT100.Tests = new TestManager.Suite('hterm.VT100.Tests');

hterm.VT100.Tests.prototype.setup = function(cx) {
  this.setDefaults(cx,
      { visibleColumnCount: 15,
        visibleRowCount: 6,
        fontSize: 15,
        lineHeight: 17,
        charWidth: 9,
        scrollbarWidth: 16,
      });
};

/**
 * Clear out the current document and create a new hterm.Terminal object for
 * testing.
 *
 * Called before each test case in this suite.
 */
hterm.VT100.Tests.prototype.preamble = function(result, cx) {
  var document = cx.window.document;

  document.body.innerHTML = '';

  var div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.height = this.lineHeight * this.visibleRowCount + 'px';
  div.style.width = this.charWidth * this.visibleColumnCount +
      this.scrollbarWidth + 'px';
  document.body.appendChild(div);

  this.div = div;

  cx.window.terminal = this.terminal = new hterm.Terminal(
      this.fontSize, this.lineHeight);

  this.terminal.decorate(div);
};

/**
 * Ensure that blink is off after the test so we don't have runaway timeouts.
 *
 * Called after each test case in this suite.
 */
hterm.VT100.Tests.prototype.postamble = function(result, cx) {
  this.terminal.setCursorBlink(false);
};

/**
 * Overridden addTest method.
 *
 * Every test in this suite needs to wait for the terminal initialization to
 * complete asynchronously.  Rather than stick a bunch of biolerplate into each
 * test case, we use this overridden addTest method to add a proxy around the
 * actual test.
 */
hterm.VT100.Tests.addTest = function(name, callback) {
  function testProxy(result, cx) {
    var self = this;
    setTimeout(function() {
        self.terminal.setCursorPosition(0, 0);
        self.terminal.setCursorVisible(true);
        callback.apply(self, [result, cx]);
      }, 0);

    result.requestTime(200);
  }

  TestManager.Suite.addTest.apply(this, [name, testProxy]);
};

/**
 * Basic sanity test to make sure that when we insert plain text it appears
 * on the screen and scrolls into the scrollback buffer correctly.
 */
hterm.VT100.Tests.addTest('sanity', function(result, cx) {
    this.terminal.interpret('0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12');

    var text = this.terminal.getRowsText(0, 13);
    result.assertEQ(text, '0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12');

    result.assertEQ(this.terminal.scrollbackRows_.length, 7);

    result.pass();
  });

/**
 * Basic cursor positioning tests.
 *
 * TODO(rginda): Test the VT52 variants too.
 */
hterm.VT100.Tests.addTest('cursor-relative', function(result, cx) {
    this.terminal.interpret('line 1\nline 2\nline 3');
    this.terminal.interpret('\x1b[A\x1b[Dtwo' +
                            '\x1b[3D' +
                            '\x1b[Aone' +
                            '\x1b[4D' +
                            '\x1b[2B' +
                            '\x1b[Cthree');
    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text, 'line one\nline two\nline three');
    result.pass();
  });

/**
 * Test absolute cursor positioning.
 */
hterm.VT100.Tests.addTest('cursor-absolute', function(result, cx) {
    this.terminal.interpret('line 1\nline 2\nline 3');

    this.terminal.interpret('\x1b[1Gline three' +
                            '\x1b[2;6Htwo' +
                            '\x1b[1;5f one');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text, 'line one\nline two\nline three');

    result.pass();
  });

/**
 * Test line positioning.
 */
hterm.VT100.Tests.addTest('line-position', function(result, cx) {
    this.terminal.interpret('line 1\nline 2\nline 3');

    this.terminal.interpret('\x1b[Fline two' +
                            '\x1b[Fline one' +
                            '\x1b[E\x1b[Eline three');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text, 'line one\nline two\nline three');
    result.pass();
  });

/**
 * Test that a partial sequence is buffered until the entire sequence is
 * received.
 */
hterm.VT100.Tests.addTest('partial-sequence', function(result, cx) {
    this.terminal.interpret('line 1\nline 2\nline three');

    this.terminal.interpret('\x1b');
    this.terminal.interpret('[');
    this.terminal.interpret('5');
    this.terminal.interpret('D');
    this.terminal.interpret('\x1b[');
    this.terminal.interpret('Atwo\x1b[3');
    this.terminal.interpret('D\x1b[Aone');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text, 'line one\nline two\nline three');
    result.pass();
  });

/**
 * Test that two ESC characters in a row are handled properly.
 */
hterm.VT100.Tests.addTest('double-sequence', function(result, cx) {
    this.terminal.interpret('line one\nline two\nline 3');

    this.terminal.interpret('\x1b[\x1b[Dthree');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text, 'line one\nline two\nline three');
    result.pass();
  });

hterm.VT100.Tests.addTest('dec-screen-test', function(result, cx) {
    this.terminal.interpret('\x1b#8');

    var text = this.terminal.getRowsText(0, 6);
    result.assertEQ(text,
                    'EEEEEEEEEEEEEEE\n' +
                    'EEEEEEEEEEEEEEE\n' +
                    'EEEEEEEEEEEEEEE\n' +
                    'EEEEEEEEEEEEEEE\n' +
                    'EEEEEEEEEEEEEEE\n' +
                    'EEEEEEEEEEEEEEE');
    result.pass();

  });

hterm.VT100.Tests.addTest('newlines-1', function(result, cx) {
    // Should be off by default.
    result.assertEQ(this.terminal.options_.autoCarriageReturn, false);

    // 0d: newline, 0b: vertical tab, 0c: form feed.
    this.terminal.interpret('newline\x0dvtab\x0bff\x0cbye');
    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'vtabine\n' +
                    '    ff\n' +
                    '      bye'
                    );

    result.pass();
  });

hterm.VT100.Tests.addTest('newlines-2', function(result, cx) {
    this.terminal.interpret('\x1b[20h');
    result.assertEQ(this.terminal.options_.autoCarriageReturn, true);

    this.terminal.interpret('newline\x0dvtab\x0bff\x0cbye');
    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'vtabine\n' +
                    'ff\n' +
                    'bye'
                    );

    result.pass();
  });

/**
 * Test the erase left command.
 */
hterm.VT100.Tests.addTest('erase-left', function(result, cx) {
    this.terminal.interpret('line one\noooooooo\nline three');
    this.terminal.interpret('\x1b[5D\x1b[A' +
                            '\x1b[1Ktw');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'line one\n' +
                    '     two\n' +
                    'line three');
    result.pass();
  });

/**
 * Test the erase right command.
 */
hterm.VT100.Tests.addTest('erase-right', function(result, cx) {
    this.terminal.interpret('line one\nline XXXX\nline three');
    this.terminal.interpret('\x1b[5D\x1b[A' +
                            '\x1b[0Ktwo');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'line one\n' +
                    'line two\n' +
                    'line three');
    result.pass();
  });

/**
 * Test the erase line command.
 */
hterm.VT100.Tests.addTest('erase-line', function(result, cx) {
    this.terminal.interpret('line one\nline twoo\nline three');
    this.terminal.interpret('\x1b[5D\x1b[A' +
                            '\x1b[2Ktwo');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'line one\n' +
                    '     two\n' +
                    'line three');
    result.pass();
  });

/**
 * Test the erase above command.
 */
hterm.VT100.Tests.addTest('erase-above', function(result, cx) {
    this.terminal.interpret('line one\noooooooo\nline three');
    this.terminal.interpret('\x1b[5D\x1b[A' +
                            '\x1b[1Jtw');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    '\n' +
                    '     two\n' +
                    'line three');
    result.pass();
  });

/**
 * Test the erase all command.
 */
hterm.VT100.Tests.addTest('erase-all', function(result, cx) {
    this.terminal.interpret('line one\nline XXXX\nline three');
    this.terminal.interpret('\x1b[5D\x1b[A' +
                            '\x1b[2Jtwo');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    '\n' +
                    '     two\n' +
                    '');
    result.pass();
  });

/**
 * Test the erase below command.
 */
hterm.VT100.Tests.addTest('erase-below', function(result, cx) {
    this.terminal.interpret('line one\nline XXXX\nline three');
    this.terminal.interpret('\x1b[5D\x1b[A' +
                            '\x1b[0Jtwo');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'line one\n' +
                    'line two\n' +
                    '');
    result.pass();
  });

/**
 * Test the erase character command.
 */
hterm.VT100.Tests.addTest('erase-char', function(result, cx) {
    this.terminal.interpret('line one\nline XXXX\nline three');
    this.terminal.interpret('\x1b[5D\x1b[A' +
                            '\x1b[4Xtwo');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'line one\n' +
                    'line two\n' +
                    'line three');
    result.pass();
  });

/**
 * Test the insert line command.
 */
hterm.VT100.Tests.addTest('insert-line', function(result, cx) {
    this.terminal.interpret('line two\nline three');
    this.terminal.interpret('\x1b[5D\x1b[2A\x1b[L' +
                            'line one');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'line one\n' +
                    'line two\n' +
                    'line three');
    result.pass();
  });

/**
 * Test the insert line command with an argument.
 */
hterm.VT100.Tests.addTest('insert-lines', function(result, cx) {
    this.terminal.interpret('line three\n\n');
    this.terminal.interpret('\x1b[5D\x1b[2A\x1b[2L' +
                            'line one\nline two');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'line one\n' +
                    'line two\n' +
                    'line three');
    result.pass();
  });

/**
 * Test that the insert line command handles overflow properly.
 */
hterm.VT100.Tests.addTest('insert-toomany-lines', function(result, cx) {
    this.terminal.interpret('XXXXX');
    this.terminal.interpret('\x1b[6L' +
                            'line one\nline two\nline three');

    var text = this.terminal.getRowsText(0, 5);
    result.assertEQ(text,
                    'line one\n' +
                    'line two\n' +
                    'line three\n' +
                    '\n' +
                    '');
    result.pass();
  });

/**
 * Test the delete line command.
 */
hterm.VT100.Tests.addTest('delete-line', function(result, cx) {
    this.terminal.interpret('line one\nline two\n' +
                            'XXXXXXXX\n' +
                            'line XXXXX');
    this.terminal.interpret('\x1b[5D\x1b[A\x1b[Mthree');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'line one\n' +
                    'line two\n' +
                    'line three');
    result.pass();
  });

/**
 * Test the delete line command with an argument.
 */
hterm.VT100.Tests.addTest('delete-lines', function(result, cx) {
    this.terminal.interpret('line one\nline two\n' +
                            'XXXXXXXX\nXXXXXXXX\n' +
                            'line XXXXX');
    this.terminal.interpret('\x1b[5D\x1b[2A\x1b[2Mthree');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'line one\n' +
                    'line two\n' +
                    'line three');
    result.pass();
  });

/**
 * Test the insert space command.
 */
hterm.VT100.Tests.addTest('insert-space', function(result, cx) {
    this.terminal.interpret('line one\nlinetwo\nline three');
    this.terminal.interpret('\x1b[6D\x1b[A\x1b[@');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'line one\n' +
                    'line two\n' +
                    'line three');
    result.pass();
  });

/**
 * Test the insert space command with an argument.
 */
hterm.VT100.Tests.addTest('insert-spaces', function(result, cx) {
    this.terminal.interpret('line one\nlinetwo\nline three');
    this.terminal.interpret('\x1b[6D\x1b[A\x1b[3@');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'line one\n' +
                    'line   two\n' +
                    'line three');
    result.pass();
  });

/**
 * Test the delete characters command.
 */
hterm.VT100.Tests.addTest('delete-chars', function(result, cx) {
    this.terminal.interpret('line one\nline XXXX\nline three');
    this.terminal.interpret('\x1b[5D\x1b[A\x1b[4Ptwo');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'line one\n' +
                    'line two\n' +
                    'line three');
    result.pass();
  });

/**
 * Test that the delete characters command handles overflow properly.
 */
hterm.VT100.Tests.addTest('delete-toomany', function(result, cx) {
    this.terminal.interpret('line one\nline XXXX\nline three');
    this.terminal.interpret('\x1b[5D\x1b[A\x1b[20Ptwo');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'line one\n' +
                    'line two\n' +
                    'line three');
    result.pass();
  });

/**
 * Test the scroll up command.
 */
hterm.VT100.Tests.addTest('scroll-up', function(result, cx) {
    this.terminal.interpret('\n\nline one\nline two\nline XXXXX');
    this.terminal.interpret('\x1b[5D\x1b[2A\x1b[2Sthree');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'line one\n' +
                    'line two\n' +
                    'line three');
    result.pass();
  });

/**
 * Test the scroll down command.
 */
hterm.VT100.Tests.addTest('scroll-down', function(result, cx) {
    this.terminal.interpret('line one\nline two\nline XXXXX\n');
    this.terminal.interpret('     \x1b[Tthree');

    var text = this.terminal.getRowsText(0, 5);
    result.assertEQ(text,
                    '\n' +
                    'line one\n' +
                    'line two\n' +
                    'line three\n' +
                    '     ');
    result.pass();
  });

/**
 * Test the absolute line positioning command.
 */
hterm.VT100.Tests.addTest('line-position-absolute', function(result, cx) {
    this.terminal.interpret('line XXX\nline YYY\nline ZZZZZ\n');
    this.terminal.interpret('     \x1b[3dthree\x1b[5D');
    this.terminal.interpret('\x1b[2dtwo\x1b[3D');
    this.terminal.interpret('\x1b[1done');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'line one\n' +
                    'line two\n' +
                    'line three');
    result.pass();
  });

/**
 * Test the device attributes command.
 */
hterm.VT100.Tests.addTest('device-attributes', function(result, cx) {
    var resultString;
    this.terminal.io.sendString = function(str) { resultString = str };

    this.terminal.interpret('\x1b[c');

    result.assertEQ(resultString, '\x1b[?1;2c');
    result.pass();
  });

/**
 * TODO(rginda): Test the clear tabstops on this line command.
 */
hterm.VT100.Tests.disableTest('clear-line-tabstops', function(result, cx) {
    '[0g';
  });

/**
 * TODO(rginda): Test the clear all tabstops command.
 */
hterm.VT100.Tests.disableTest('clear-all-tabstops', function(result, cx) {
    '[3g';
  });

/**
 * TODO(rginda): Test text attributes.
 */
hterm.VT100.Tests.disableTest('color-change', function(result, cx) {
    '[Xm';
  });

/**
 * Test the status report command.
 */
hterm.VT100.Tests.addTest('status-report', function(result, cx) {
    var resultString;
    terminal.io.sendString = function (str) { resultString = str };

    this.terminal.interpret('\x1b[5n');
    result.assertEQ(resultString, '\x1b0n');

    resultString = '';

    this.terminal.interpret('line one\nline two\nline three');
    // Reposition the cursor and ask for a position report.
    this.terminal.interpret('\x1b[5D\x1b[A\x1b[6n');
    result.assertEQ(resultString, '\x1b[2;6R');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'line one\n' +
                    'line two\n' +
                    'line three');

    result.pass();
  });

/**
 * Test that various mode commands correctly change the state of the terminal.
 *
 * Most of these should have more in-depth testing below.
 */
hterm.VT100.Tests.addTest('mode-bits', function(result, cx) {
    this.terminal.interpret('\x1b[?1h');
    result.assertEQ(this.terminal.vt.applicationCursor, true);

    this.terminal.interpret('\x1b[?1l');
    result.assertEQ(this.terminal.vt.applicationCursor, false);

    var fg = this.terminal.foregroundColor;
    var bg = this.terminal.backgroundColor;

    this.terminal.interpret('\x1b[?5h');
    result.assertEQ(this.terminal.scrollPort_.getForegroundColor(), bg);
    result.assertEQ(this.terminal.scrollPort_.getBackgroundColor(), fg);

    this.terminal.interpret('\x1b[?5l');
    result.assertEQ(this.terminal.scrollPort_.getForegroundColor(), fg);
    result.assertEQ(this.terminal.scrollPort_.getBackgroundColor(), bg);

    this.terminal.interpret('\x1b[?5l');
    result.assertEQ(this.terminal.scrollPort_.getForegroundColor(), fg);
    result.assertEQ(this.terminal.scrollPort_.getBackgroundColor(), bg);

    this.terminal.interpret('\x1b[?6h');
    result.assertEQ(this.terminal.options_.originMode, true);

    this.terminal.interpret('\x1b[?6l');
    result.assertEQ(this.terminal.options_.originMode, false);

    this.terminal.interpret('\x1b[4h');
    result.assertEQ(this.terminal.options_.insertMode, true);

    this.terminal.interpret('\x1b[4l');
    result.assertEQ(this.terminal.options_.insertMode, false);

    this.terminal.interpret('\x1b[?7h');
    result.assertEQ(this.terminal.options_.wraparound, true);

    this.terminal.interpret('\x1b[?7l');
    result.assertEQ(this.terminal.options_.wraparound, false);

    /*
    this.terminal.interpret('\x1b[?12l');
    result.assertEQ(this.terminal.options_.cursorBlink, false);
    result.assert(!('cursorBlink' in this.terminal.timeouts_));

    this.terminal.interpret('\x1b[?12h');
    result.assertEQ(this.terminal.options_.cursorBlink, true);
    result.assert('cursorBlink' in this.terminal.timeouts_);
    */

    this.terminal.interpret('\x1b[?25l');
    result.assertEQ(this.terminal.options_.cursorVisible, false);
    result.assertEQ(this.terminal.cursorNode_.style.opacity, '0');

    this.terminal.interpret('\x1b[?25h');
    result.assertEQ(this.terminal.options_.cursorVisible, true);

    // Turn off blink so we know the cursor should be on.
    this.terminal.interpret('\x1b[?12l');
    result.assertEQ(this.terminal.cursorNode_.style.opacity, '1');

    this.terminal.interpret('\x1b[?45h');
    result.assertEQ(this.terminal.options_.reverseWraparound, true);

    this.terminal.interpret('\x1b[?45l');
    result.assertEQ(this.terminal.options_.reverseWraparound, false);

    this.terminal.interpret('\x1b[?67h');
    result.assertEQ(this.terminal.vt.backspaceSendsBackspace, true);

    this.terminal.interpret('\x1b[?67l');
    result.assertEQ(this.terminal.vt.backspaceSendsBackspace, false);

    this.terminal.interpret('\x1b[?1036h');
    result.assertEQ(this.terminal.vt.metaSendsEscape, true);

    this.terminal.interpret('\x1b[?1036l');
    result.assertEQ(this.terminal.vt.metaSendsEscape, false);

    this.terminal.interpret('\x1b[?1039h');
    result.assertEQ(this.terminal.vt.altSendsEscape, true);

    this.terminal.interpret('\x1b[?1039l');
    result.assertEQ(this.terminal.vt.altSendsEscape, false);

    result.assertEQ(this.terminal.screen_,
                    this.terminal.primaryScreen_);

    this.terminal.interpret('\x1b[?1049h');
    result.assertEQ(this.terminal.screen_,
                    this.terminal.alternateScreen_);

    this.terminal.interpret('\x1b[?1049l');
    result.assertEQ(this.terminal.screen_,
                    this.terminal.primaryScreen_);

    result.pass();
  });

/**
 * TODO(rginda): Test origin mode.
 */
hterm.VT100.Tests.disableTest('origin-mode', function(result, cx) {
  });

/**
 * Test insert/overwrite mode.
 */
hterm.VT100.Tests.addTest('insert-mode', function(result, cx) {
    // Should be off by default.
    result.assertEQ(this.terminal.options_.insertMode, false);

    this.terminal.interpret('\x1b[4h');
    this.terminal.interpret(' one\x1b[4Dline\n');

    this.terminal.interpret('\x1b[4l');
    this.terminal.interpret('XXXXXXXX\x1b[8Dline two\n');

    this.terminal.interpret('\x1b[4h');
    this.terminal.interpret(' three\x1b[6Dline');

    var text = this.terminal.getRowsText(0, 3);
    result.assertEQ(text,
                    'line one\n' +
                    'line two\n' +
                    'line three');

    result.pass();
  });

/**
 * Test wraparound mode.
 */
hterm.VT100.Tests.addTest('wraparound-mode-on', function(result, cx) {
    // Should be on by default.
    result.assertEQ(this.terminal.options_.wraparound, true);

    this.terminal.interpret('-----  1  -----');
    this.terminal.interpret('-----  2  -----');
    this.terminal.interpret('-----  3  -----');
    this.terminal.interpret('-----  4  -----');
    this.terminal.interpret('-----  5  -----');
    this.terminal.interpret('-----  6  -----');

    var text = this.terminal.getRowsText(1, 7);
    result.assertEQ(text,
                    '-----  2  -----\n' +
                    '-----  3  -----\n' +
                    '-----  4  -----\n' +
                    '-----  5  -----\n' +
                    '-----  6  -----\n' +
                    '');

    result.assertEQ(this.terminal.getCursorRow(), 5);
    result.assertEQ(this.terminal.getCursorColumn(), 0);

    result.pass();
  });

hterm.VT100.Tests.addTest('wraparound-mode-off', function(result, cx) {
    this.terminal.interpret('\x1b[?7l');
    result.assertEQ(this.terminal.options_.wraparound, false);

    this.terminal.interpret('-----  1  -----');
    this.terminal.interpret('-----  2  -----');
    this.terminal.interpret('-----  3  -----');
    this.terminal.interpret('-----  4  -----');
    this.terminal.interpret('-----  5  -----');
    this.terminal.interpret('-----  6  -----');

    var text = this.terminal.getRowsText(0, 6);
    result.assertEQ(text,
                    '-----  1  -----\n' +
                    '\n' +
                    '\n' +
                    '\n' +
                    '\n' +
                    '');

    result.assertEQ(this.terminal.getCursorRow(), 0);
    result.assertEQ(this.terminal.getCursorColumn(), 14);

    result.pass();
  });

/**
 * Test the interactions between insert and wraparound modes.
 */
hterm.VT100.Tests.addTest('insert-wrap', function(result, cx) {
    // Should be on by default.
    result.assertEQ(this.terminal.options_.wraparound, true);

    this.terminal.interpret('' + // Insert off, wrap on (default).
                            '[15GAAAA[1GXX\n' +
                            '[4h[?7l' +  // Insert on, wrap off.
                            '[15GAAAA[1GXX\n' +
                            '[4h[?7h' +  // Insert on, wrap on.
                            '[15GAAAA[1GXX\n' +
                            '[4l[?7l' +  // Insert off, wrap off.
                            '[15GAAAA[1GXX');

    var text = this.terminal.getRowsText(0, 6);
    result.assertEQ(text,
                    '              A\n' +
                    'XXA\n' +

                    'XX             \n' +

                    '              A\n' +
                    'XXAAA\n' +

                    'XX            A');


    result.pass();
  });

hterm.VT100.Tests.addTest('alternate-screen', function(result, cx) {
    this.terminal.interpret('1\n2\n3\n4\n5\n6\n7\n8\n9\n10');
    this.terminal.interpret('\x1b[3;3f');  // Leave the cursor at (3,3)
    var text = this.terminal.getRowsText(0, 10);
    result.assertEQ(text, '1\n2\n3\n4\n5\n6\n7\n8\n9\n10');

    // Switch to alternate screen.
    this.terminal.interpret('\x1b[?1049h');
    text = this.terminal.getRowsText(0, 10);
    result.assertEQ(text, '1\n2\n3\n4\n\n\n\n\n\n');

    this.terminal.interpret('\nhi');
    text = this.terminal.getRowsText(0, 10);
    result.assertEQ(text, '1\n2\n3\n4\n\nhi\n\n\n\n');

    // Switch back to primary screen.
    this.terminal.interpret('\x1b[?1049l');
    text = this.terminal.getRowsText(0, 10);
    result.assertEQ(text, '1\n2\n3\n4\n5\n6\n7\n8\n9\n10');

    this.terminal.interpret('XX');
    text = this.terminal.getRowsText(0, 10);
    result.assertEQ(text, '1\n2\n3\n4\n5\n6\n7 XX\n8\n9\n10');

    // Aand back to alternate screen.
    this.terminal.interpret('\x1b[?1049h');
    text = this.terminal.getRowsText(0, 10);
    result.assertEQ(text, '1\n2\n3\n4\n\nhi\n\n\n\n');

    this.terminal.interpret('XX');
    text = this.terminal.getRowsText(0, 10);
    result.assertEQ(text, '1\n2\n3\n4\n\nhiXX\n\n\n\n');

    result.pass();
  });


hterm.VT100.Tests.addTest('fullscreen', function(result, cx) {
    this.div.style.height = '100%';
    this.div.style.width = '100%';

    var self = this;

    setTimeout(function() {
        for (var i = 0; i < 1000; i++) {
          var indent = i % 40;
          if (indent > 20)
            indent = 40 - indent;

          self.terminal.interpret('Line ' + hterm.zpad(i, 3) + ': ' +
                                  hterm.getWhitespace(indent) + '*\n');
        }

        result.pass();
      }, 100);

    result.requestTime(200);
  });