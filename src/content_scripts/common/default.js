import { RUNTIME, dispatchSKEvent, runtime } from './runtime.js';
import KeyboardUtils from './keyboardUtils';
import {
    actionWithSelectionPreserved,
    getBrowserName,
    getCssSelectorsOfEditable,
    getRealEdit,
    getTextNodePos,
    getWordUnderCursor,
    htmlEncode,
    setSanitizedContent,
    showBanner,
    showPopup,
    tabOpenLink,
    toggleQuote,
} from './utils.js';

export default function(api, insert, normal, hints, visual, front, browser) {
    const {
        map,
        mapkey,
        imapkey,
        readText,
        vmapkey,
    } = api;

    mapkey('[[', '#1Click on the previous link on current page', hints.previousPage);
    mapkey(']]', '#1Click on the next link on current page', hints.nextPage);
    mapkey('T', '#3Choose a tab', function() {
        front.chooseTab();
    });
    mapkey('?', '#0Show usage', function() {
        front.showUsage();
    });
    imapkey("<Ctrl-'>", '#11Toggle quotes in an input element', toggleQuote);

    mapkey(";ql", '#0Show last action', function() {
        showPopup(htmlEncode(runtime.conf.lastKeys.map(function(k) {
            return KeyboardUtils.decodeKeystroke(k);
        }).join(' → ')));
    }, {repeatIgnore: true});

    mapkey('gi', '#1Go to the first edit box', function() {
        hints.createInputLayer();
    });
    mapkey('i', '#1Go to edit box', function() {
        hints.create(getCssSelectorsOfEditable(), hints.dispatchMouseClick);
    });

    mapkey('zv', '#6Enter visual mode, and select whole element', function() {
        visual.toggle("z");
    });
    mapkey('V', '#6Restore visual mode', function() {
        visual.restore();
    });
    mapkey('*', '#6Find selected text in current page', function() {
        visual.star();
        visual.toggle();
    });

    vmapkey('<Ctrl-u>', '#6Backward 20 lines', function() {
        visual.feedkeys('20k');
    });
    vmapkey('<Ctrl-d>', '#6Forward 20 lines', function() {
        visual.feedkeys('20j');
    });

    mapkey('m', '#7Add current URL to vim-like marks', normal.addVIMark);
    mapkey("'", '#7Jump to vim-like mark', normal.jumpVIMark);
    mapkey("<Ctrl-'>", '#7Jump to vim-like mark in new tab.', function(mark) {
        normal.jumpVIMark(mark);
    });

    mapkey('w', '#2Switch frames', function() {
        // ensure frontend ready so that ui related actions can be available in iframes.
        dispatchSKEvent('ensureFrontEnd');
        if (window !== top || !hints.create("iframe", function(element) {
            element.scrollIntoView({
                behavior: 'auto',
                block: 'center',
                inline: 'center'
            });
            normal.highlightElement(element);
            element.contentWindow.focus();
        })) {
            normal.rotateFrame();
        }
    });

    mapkey('yg', '#3Capture current page', function() {
        front.toggleStatus(false);
        setTimeout(function() {
            RUNTIME('captureVisibleTab', null, function(response) {
                front.toggleStatus(true);
                showPopup("<img src='{0}' />".format(response.dataUrl));
            });
        }, 500);
    });

    mapkey('gu', '#4Go up one path in the URL', function() {
        var pathname = location.pathname;
        if (pathname.length > 1) {
            pathname = pathname.endsWith('/') ? pathname.substr(0, pathname.length - 1) : pathname;
            var last = pathname.lastIndexOf('/'), repeats = RUNTIME.repeats;
            RUNTIME.repeats = 1;
            while (repeats-- > 1) {
                var p = pathname.lastIndexOf('/', last - 1);
                if (p === -1) {
                    break;
                } else {
                    last = p;
                }
            }
            pathname = pathname.substr(0, last);
        }
        window.location.href = location.origin + pathname;
    });

    mapkey(';m', '#1mouse out last element', function() {
        hints.mouseoutLastElement();
    });


    mapkey('O', '#1Open detected links from text', function() {
        hints.create(runtime.conf.clickablePat, function(element) {
            window.location.assign(element[2]);
        }, {statusLine: "Open detected links from text"});
    });

    mapkey(".", '#0Repeat last action', function() {
        // lastKeys in format: <keys in normal mode>[,(<mode name>\t<keys in this mode>)*], examples
        // ['se']
        // ['f', 'Hints\tBA']
        const lastKeys = runtime.conf.lastKeys;
        normal.feedkeys(lastKeys[0]);
        var modeKeys = lastKeys.slice(1);
        for (var i = 0; i < modeKeys.length; i++) {
            var modeKey = modeKeys[i].split('\t');
            if (modeKey[0] === 'Hints') {
                function closureWrapper() {
                    var hintKeys = modeKey[1];
                    return function() {
                        hints.feedkeys(hintKeys);
                    };
                }
                setTimeout(closureWrapper(), 120 + i*100);
            }
        }
    }, {repeatIgnore: true});

    mapkey("f", '#1Open a link, press SHIFT to flip overlapped hints, hold SPACE to hide hints', function() {
        hints.create("", hints.dispatchMouseClick);
    }, {repeatIgnore: true});

    mapkey("v", '#6Toggle visual mode', function() {
        visual.toggle();
    }, {repeatIgnore: true});

    mapkey("n", '#6Next found text', function() {
        visual.next(false);
    }, {repeatIgnore: true});

    mapkey("N", '#6Previous found text', function() {
        visual.next(true);
    }, {repeatIgnore: true});

    mapkey(";fs", '#1Display hints to focus scrollable elements', function() {
        hints.create(normal.refreshScrollableElements(), hints.dispatchMouseClick);
    });

    function getSentence(textNode, offset) {
        var sentence = "";

        actionWithSelectionPreserved(function(sel) {
            sel.setPosition(textNode, offset);
            sel.modify("extend", "backward", "sentence");
            sel.collapseToStart();
            sel.modify("extend", "forward", "sentence");

            sentence = sel.toString();
        });

        return sentence.replace(/\n/g, '');
    }

    mapkey('g0', '#3Go to the first tab', function() {
        normal.feedkeys('99E');
    });
    mapkey('g$', '#3Go to the first tab', function() {
            normal.feedkeys('99R');
    });
    mapkey('zr', '#3zoom reset', function() {
        RUNTIME('setZoom', {
            zoomFactor: 0
        });
    });
    mapkey('zi', '#3zoom in', function() {
        RUNTIME('setZoom', {
            zoomFactor: 0.1
        });
    });
    mapkey('zo', '#3zoom out', function() {
        RUNTIME('setZoom', {
            zoomFactor: -0.1
        });
    });

    mapkey('ZZ', '#5Save session and quit', function() {
        RUNTIME('createSession', {
            name: 'LAST',
            quitAfterSaved: true
        });
    });
    mapkey('ZR', '#5Restore last session', function() {
        RUNTIME('openSession', {
            name: 'LAST'
        });
    });
    map('u', 'e');
    mapkey('af', '#1Open a link in active new tab', function() {
        hints.create("", hints.dispatchMouseClick, {tabbed: true, active: true});
    });
    mapkey('gf', '#1Open a link in non-active new tab', function() {
        hints.create("", hints.dispatchMouseClick, {tabbed: true, active: false});
    });
    mapkey('cf', '#1Open multiple links in a new tab', function() {
        hints.create("", hints.dispatchMouseClick, {multipleHits: true});
    });
    map('C', 'gf');
    mapkey('<Ctrl-h>', '#1Mouse over elements.', function() {
        hints.create("", (element, event) => {
            if (chrome.surfingkeys) {
                const r = element.getClientRects()[0];
                chrome.surfingkeys.sendMouseEvent(2, Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2), 0);
            } else {
                hints.dispatchMouseClick(element, event);
            }
        }, {mouseEvents: ["mouseover"]});
    });
    mapkey('<Ctrl-j>', '#1Mouse out elements.', function() {
        hints.create("", hints.dispatchMouseClick, {mouseEvents: ["mouseout"]});
    });
    function getTableColumnHeads() {
        var tds = [];
        document.querySelectorAll("table").forEach(function(t) {
            var tr = t.querySelector("tr");
            if (tr) {
                tds.push(...tr.children);
            }
        });
        return tds;
    }

    map('<Ctrl-i>', 'I');
    mapkey('q', '#1Click on an Image or a button', function() {
        hints.create("img, button", hints.dispatchMouseClick);
    });
    mapkey('<Alt-p>', '#3pin/unpin current tab', function() {
        RUNTIME("togglePinTab");
    });
    mapkey('<Alt-m>', '#3mute/unmute current tab', function() {
        RUNTIME("muteTab");
    });
    mapkey('<Ctrl-6>', '#4Go to last used tab', function() {
        RUNTIME("goToLastTab");
    });
    mapkey('gp', '#4Go to the playing tab', function() {
        RUNTIME('getTabs', { queryInfo: {audible: true}}, response => {
            if (response.tabs?.at(0)) {
                const tab = response.tabs[0]
                RUNTIME('focusTab', {
                    windowId: tab.windowId,
                    tabId: tab.id
                });
            }
        })
    }, { repeatIgnore: true });
    mapkey('r', '#4Reload the page', function() {
        RUNTIME("reloadTab", { nocache: false });
    });
    mapkey('x', '#3Close current tab', function() {
        RUNTIME("closeTab");
    });
    mapkey(';w', '#2Focus top window', function() {
        top.focus();
    });
    mapkey('yt', '#3Duplicate current tab', function() {
        RUNTIME("duplicateTab");
    });
    mapkey('yT', '#3Duplicate current tab in background', function() {
        RUNTIME("duplicateTab", {active: false});
    });

    function getFormData(form, format) {
        var formData = new FormData(form);
        if (format === "json") {
            var obj = {};

            formData.forEach(function (value, key) {
                if (obj.hasOwnProperty(key)) {
                    if (value.length) {
                        var p = obj[key];
                        if (p.constructor.name === "Array") {
                            p.push(value);
                        } else {
                            obj[key] = [];
                            if (p.length) {
                                obj[key].push(p);
                            }
                            obj[key].push(value);
                        }
                    }
                } else {
                    obj[key] = value;
                }
            });

            return obj;
        } else {
            return new URLSearchParams(formData).toString();
        }
    }
    function generateFormKey(form) {
        return (form.method || "get") + "::" + new URL(form.action).pathname;
    }

    mapkey('g?', '#4Reload current page without query string(all parts after question mark)', function() {
        window.location.href = window.location.href.replace(/\?[^\?]*$/, '');
    });
    mapkey('g#', '#4Reload current page without hash fragment', function() {
        window.location.href = window.location.href.replace(/\#[^\#]*$/, '');
    });
    mapkey('gU', '#4Go to root of current URL hierarchy', function() {
        window.location.href = window.location.origin;
    });
    mapkey('gxt', '#3Close tab on left', function() {
        RUNTIME("closeTabLeft");
    });
    mapkey('gxT', '#3Close tab on right', function() {
        RUNTIME("closeTabRight");
    });
    mapkey('gx0', '#3Close all tabs on left', function() {
        RUNTIME("closeTabsToLeft");
    });
    mapkey('gx$', '#3Close all tabs on right', function() {
        RUNTIME("closeTabsToRight");
    });
    mapkey('gxx', '#3Close all tabs except current one', function() {
        RUNTIME("tabOnly");
    });
    mapkey('gxp', '#3Close playing tab', function() {
        RUNTIME("closeAudibleTab");
    });
    mapkey(';e', '#8Edit Settings', function() {
        tabOpenLink("/pages/options.html");
    });

    const bn = getBrowserName();
    if (bn === "Firefox") {
        mapkey('on', '#3Open newtab', function() {
            tabOpenLink("about:blank");
        });
    } else if (bn === "Chrome") {
        vmapkey('gr', '#6Read selected text', function() {
            readText(window.getSelection().toString(), {verbose: true});
        });

        mapkey('on', '#3Open newtab', function() {
            tabOpenLink("chrome://newtab/");
        });
        mapkey('ga', '#9Open Chrome About', function() {
            tabOpenLink("chrome://help/");
        });
        mapkey('gc', '#9Open Chrome Cache', function() {
            tabOpenLink("chrome://cache/");
        });
        mapkey('gd', '#9Open Chrome Downloads', function() {
            tabOpenLink("chrome://downloads/");
        });
        mapkey('gh', '#9Open Chrome History', function() {
            tabOpenLink("chrome://history/");
        });
        mapkey('gk', '#9Open Chrome Cookies', function() {
            tabOpenLink("chrome://settings/cookies");
        });
        mapkey('ge', '#9Open Chrome Extensions', function() {
            tabOpenLink("chrome://extensions/");
        });
        mapkey('gn', '#9Open Chrome net-internals', function() {
            tabOpenLink("chrome://net-internals/#proxy");
        });
        mapkey(';i', '#9Open Chrome Inspect', function() {
            tabOpenLink("chrome://inspect/#devices");
        });
    }

    if (!getBrowserName().startsWith("Safari")) {
        mapkey('X', '#3Restore closed tab', function() {
            RUNTIME("openLast");
        });
        mapkey(';gw', '#3Gather all tabs into current window',  function() {
            RUNTIME("gatherWindows");
        });
        mapkey('<<', '#3Move current tab to left', function() {
            RUNTIME('moveTab', {
                step: -1
            });
        });
        mapkey('>>', '#3Move current tab to right', function() {
            RUNTIME('moveTab', {
                step: 1
            });
        });
        mapkey('gs', '#9View page source', function() {
            RUNTIME("viewSource", { tab: { tabbed: true }});
        });
    }
}
