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

export default function(api, clipboard, insert, normal, hints, visual, front, browser) {
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
    imapkey("<Ctrl-'>", '#13Toggle quotes in an input element', toggleQuote);

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

    mapkey('zv', '#7Enter visual mode, and select whole element', function() {
        visual.toggle("z");
    });
    mapkey('yv', '#6Yank text of an element', function() {
        hints.create(runtime.conf.textAnchorPat, function (element) {
            clipboard.write(element[1] === 0 ? element[0].data.trim() : element[2].trim());
        });
    });
    mapkey('ymv', '#6Yank text of multiple elements', function() {
        var textToYank = [];
        hints.create(runtime.conf.textAnchorPat, function (element) {
            textToYank.push(element[1] === 0 ? element[0].data.trim() : element[2].trim());
            clipboard.write(textToYank.join('\n'));
        }, { multipleHits: true });
    });

    mapkey('V', '#7Restore visual mode', function() {
        visual.restore();
    });
    mapkey('*', '#7Find selected text in current page', function() {
        visual.star();
        visual.toggle();
    });

    vmapkey('<Ctrl-u>', '#7Backward 20 lines', function() {
        visual.feedkeys('20k');
    });
    vmapkey('<Ctrl-d>', '#7Forward 20 lines', function() {
        visual.feedkeys('20j');
    });

    mapkey('m', '#8Add current URL to vim-like marks', normal.addVIMark);
    mapkey("'", '#8Jump to vim-like mark', normal.jumpVIMark);
    mapkey("<Ctrl-'>", '#8Jump to vim-like mark in new tab.', function(mark) {
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

    mapkey('yg', '#6Capture current page', function() {
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

    mapkey(';pp', '#6Paste html on current page', function() {
        clipboard.read(function(response) {
            document.documentElement.removeAttributes();
            document.body.removeAttributes();
            setSanitizedContent(document.head, "<title>" + new Date() +" updated by Surfingkeys</title>");
            setSanitizedContent(document.body, response.data);
        });
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

    mapkey("v", '#7Toggle visual mode', function() {
        visual.toggle();
    }, {repeatIgnore: true});

    mapkey("n", '#7Next found text', function() {
        visual.next(false);
    }, {repeatIgnore: true});

    mapkey("N", '#7Previous found text', function() {
        visual.next(true);
    }, {repeatIgnore: true});

    mapkey(";fs", '#1Display hints to focus scrollable elements', function() {
        hints.create(normal.refreshScrollableElements(), hints.dispatchMouseClick);
    });

    vmapkey("q", '#7Translate word under cursor', function() {
        var w = getWordUnderCursor();
        browser.readText(w);
        var b = visual.getCursorPixelPos();
        front.performInlineQuery(w, {
            top: b.top,
            left: b.left,
            height: b.height,
            width: b.width
        }, function(pos, queryResult) {
            dispatchSKEvent("front", ['showBubble', pos, queryResult, true]);
        });
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

    mapkey("cq", '#6Query word with Hints', function() {
        hints.create(runtime.conf.textAnchorPat, function (element) {
            var word = element[2].trim().replace(/[^A-z].*$/, "");
            var b = getTextNodePos(element[0], element[1], element[2].length);
            front.performInlineQuery(word, {
                top: b.top,
                left: b.left,
                height: b.height,
                width: b.width
            }, function (pos, queryResult) {
                dispatchSKEvent("front", ['showBubble', pos, queryResult, false]);
            });
        });
    });

    
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
    mapkey('ya', '#6Copy a link URL to the clipboard', function() {
        hints.create('*[href]', function(element) {
            clipboard.write(element.href);
        });
    });
    mapkey('yma', '#6Copy multiple link URLs to the clipboard', function() {
        var linksToYank = [];
        hints.create('*[href]', function(element) {
            linksToYank.push(element.href);
            clipboard.write(linksToYank.join('\n'));
        }, {multipleHits: true});
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
    mapkey('yc', '#6Copy a column of a table', function() {
        hints.create(getTableColumnHeads(), function(element) {
            var column = Array.from(element.closest("table").querySelectorAll("tr")).map(function(tr) {
                return tr.children.length > element.cellIndex ? tr.children[element.cellIndex].innerText : "";
            });
            clipboard.write(column.join("\n"));
        });
    });
    mapkey('ymc', '#6Copy multiple columns of a table', function() {
        var rows = null;
        hints.create(getTableColumnHeads(), function(element) {
            var column = Array.from(element.closest("table").querySelectorAll("tr")).map(function(tr) {
                return tr.children.length > element.cellIndex ? tr.children[element.cellIndex].innerText : "";
            });
            if (!rows) {
                rows = column;
            } else {
                column.forEach(function(c, i) {
                    rows[i] += "\t" + c;
                });
            }
            clipboard.write(rows.join("\n"));
        }, {multipleHits: true});
    });
    mapkey('yq', '#6Copy pre text', function() {
        hints.create("pre", function(element) {
            clipboard.write(element.innerText);
        });
    });

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
    mapkey('B', '#4Go one tab history back', function() {
        RUNTIME("historyTab", {backward: true});
    }, {repeatIgnore: true});
    mapkey('F', '#4Go one tab history forward', function() {
        RUNTIME("historyTab", {backward: false});
    }, {repeatIgnore: true});
    mapkey('<Ctrl-6>', '#4Go to last used tab', function() {
        RUNTIME("goToLastTab");
    });
    mapkey('gT', '#4Go to first activated tab', function() {
        RUNTIME("historyTab", {index: 0});
    }, {repeatIgnore: true});
    mapkey('gt', '#4Go to last activated tab', function() {
        RUNTIME("historyTab", {index: -1});
    }, {repeatIgnore: true});
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
    mapkey('S', '#4Go back in history', function() {
        history.go(-1);
    }, {repeatIgnore: true});
    mapkey('D', '#4Go forward in history', function() {
        history.go(1);
    }, {repeatIgnore: true});
    mapkey('r', '#4Reload the page', function() {
        RUNTIME("reloadTab", { nocache: false });
    });
    mapkey('yi', '#6Yank text of an input', function() {
        hints.create("input, textarea, select", function(element) {
            clipboard.write(element.value);
        });
    });
    mapkey('x', '#3Close current tab', function() {
        RUNTIME("closeTab");
    });
    mapkey(';w', '#2Focus top window', function() {
        top.focus();
    });
    mapkey('cc', '#6Open selected link or link from clipboard', function() {
        if (window.getSelection().toString()) {
            tabOpenLink(window.getSelection().toString());
        } else {
            clipboard.read(function(response) {
                tabOpenLink(response.data);
            });
        }
    });
    mapkey(';cq', '#6Clear all URLs in queue to be opened', function() {
        RUNTIME('clearQueueURLs');
    });
    mapkey('ys', "#6Copy current page's source", function() {
        var aa = document.documentElement.cloneNode(true);
        clipboard.write(aa.outerHTML);
    });
    mapkey('yj', "#6Copy current settings", function() {
        RUNTIME('getSettings', {
            key: "RAW"
        }, function(response) {
            clipboard.write(JSON.stringify(response.settings, null, 4));
        });
    });
    mapkey(';pj', "#6Restore settings data from clipboard", function() {
        clipboard.read(function(response) {
            RUNTIME('updateSettings', {
                settings: JSON.parse(response.data.trim())
            });
        });
    });
    mapkey('yt', '#3Duplicate current tab', function() {
        RUNTIME("duplicateTab");
    });
    mapkey('yT', '#3Duplicate current tab in background', function() {
        RUNTIME("duplicateTab", {active: false});
    });
    mapkey('yy', "#6Copy current page's URL", function() {
        var url = window.location.href;
        clipboard.write(url);
    });
    mapkey('yY', "#6Copy all tabs's url", function() {
        RUNTIME('getTabs', null, function (response) {
            clipboard.write(response.tabs.map(tab => tab.url).join('\n'));
        });
    });
    mapkey('yh', "#6Copy current page's host", function() {
        var url = new URL(window.location.href);
        clipboard.write(url.host);
    });
    mapkey('yl', "#6Copy current page's title", function() {
        clipboard.write(document.title);
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
    mapkey('yf', '#6Copy form data in JSON on current page', function() {
        var fd = {};
        document.querySelectorAll('form').forEach(function(form) {
            fd[generateFormKey(form)] = getFormData(form, "json");
        });
        clipboard.write(JSON.stringify(fd, null, 4));
    });
    mapkey(';pf', '#6Fill form with data from yf', function() {
        hints.create('form', function(element, event) {
            var formKey = generateFormKey(element);
            clipboard.read(function(response) {
                var forms = JSON.parse(response.data.trim());
                if (forms.hasOwnProperty(formKey)) {
                    var fd = forms[formKey];
                    element.querySelectorAll('input, textarea').forEach(function(ip) {
                        if (fd.hasOwnProperty(ip.name) && ip.type !== "hidden") {
                            if (ip.type === "radio") {
                                var op = element.querySelector(`input[name='${ip.name}'][value='${fd[ip.name]}']`);
                                if (op) {
                                    op.checked = true;
                                }
                            } else if (Array.isArray(fd[ip.name])) {
                                element.querySelectorAll(`input[name='${ip.name}']`).forEach(function(ip) {
                                    ip.checked = false;
                                });
                                var vals = fd[ip.name];
                                vals.forEach(function(v) {
                                    var op = element.querySelector(`input[name='${ip.name}'][value='${v}']`);
                                    if (op) {
                                        op.checked = true;
                                    }
                                });
                            } else if (typeof(fd[ip.name]) === "string") {
                                ip.value = fd[ip.name];
                            }
                        }
                    });
                } else {
                    showBanner("No form data found for your selection from clipboard.");
                }
            });
        });
    });
    mapkey('yp', '#6Copy form data for POST on current page', function() {
        var aa = [];
        document.querySelectorAll('form').forEach(function(form) {
            var fd = {};
            fd[(form.method || "get") + "::" + form.action] = getFormData(form);
            aa.push(fd);
        });
        clipboard.write(JSON.stringify(aa, null, 4));
    });

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
    mapkey(';e', '#9Edit Settings', function() {
        tabOpenLink("/pages/options.html");
    });

    const bn = getBrowserName();
    if (bn === "Firefox") {
        mapkey('on', '#3Open newtab', function() {
            tabOpenLink("about:blank");
        });
    } else if (bn === "Chrome") {
        mapkey('cp', '#11Toggle proxy for current site', function() {
            var host = window.location.host.replace(/:\d+/,'');
            if (host && host.length) {
                RUNTIME('updateProxy', {
                    host: host,
                    operation: "toggle"
                });
            }
        });
        mapkey(';cp', '#11Copy proxy info', function() {
            RUNTIME('getSettings', {
                key: ['proxyMode', 'proxy', 'autoproxy_hosts']
            }, function(response) {
                clipboard.write(JSON.stringify(response.settings, null, 4));
            });
        });
        mapkey(';ap', '#11Apply proxy info from clipboard', function() {
            clipboard.read(function(response) {
                var proxyConf = JSON.parse(response.data);
                RUNTIME('updateProxy', {
                    operation: 'set',
                    host: proxyConf.autoproxy_hosts,
                    proxy: proxyConf.proxy,
                    mode: proxyConf.proxyMode
                });
            });
        });
        mapkey('gr', '#12Read selected text or text from clipboard', function() {
            clipboard.read(function(response) {
                readText(window.getSelection().toString() || response.data, {verbose: true});
            });
        });
        vmapkey('gr', '#7Read selected text', function() {
            readText(window.getSelection().toString(), {verbose: true});
        });

        mapkey('on', '#3Open newtab', function() {
            tabOpenLink("chrome://newtab/");
        });
        mapkey('ga', '#10Open Chrome About', function() {
            tabOpenLink("chrome://help/");
        });
        mapkey('gb', '#10Open Chrome Bookmarks', function() {
            tabOpenLink("chrome://bookmarks/");
        });
        mapkey('gc', '#10Open Chrome Cache', function() {
            tabOpenLink("chrome://cache/");
        });
        mapkey('gd', '#10Open Chrome Downloads', function() {
            tabOpenLink("chrome://downloads/");
        });
        mapkey('gh', '#10Open Chrome History', function() {
            tabOpenLink("chrome://history/");
        });
        mapkey('gk', '#10Open Chrome Cookies', function() {
            tabOpenLink("chrome://settings/cookies");
        });
        mapkey('ge', '#10Open Chrome Extensions', function() {
            tabOpenLink("chrome://extensions/");
        });
        mapkey('gn', '#10Open Chrome net-internals', function() {
            tabOpenLink("chrome://net-internals/#proxy");
        });
        mapkey(';i', '#10Open Chrome Inspect', function() {
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
        mapkey('yd', "#6Copy current downloading URL", function() {
            RUNTIME('getDownloads', {
                query: {state: "in_progress"}
            }, function(response) {
                var items = response.downloads.map(function(o) {
                    return o.url;
                });
                clipboard.write(items.join(','));
            });
        });
        mapkey('gs', '#10View page source', function() {
            RUNTIME("viewSource", { tab: { tabbed: true }});
        });
        mapkey(';di', '#1Download image', function() {
            hints.create('img', function(element) {
                RUNTIME('download', {
                    url: element.src
                });
            });
        });
        mapkey(';j', '#10Close Downloads Shelf', function() {
            RUNTIME("closeDownloadsShelf", {clearHistory: true});
        });
        mapkey(';dh', '#12Delete history older than 30 days', function() {
            RUNTIME('deleteHistoryOlderThan', {
                days: 30
            });
        });
        mapkey(';yh', '#12Yank histories', function() {
            RUNTIME('getHistory', {}, function(response) {
                clipboard.write(response.history.map(h => h.url).join("\n"));
            });
        });
        mapkey(';ph', '#12Put histories from clipboard', function() {
            clipboard.read(function(response) {
                RUNTIME('addHistories', {history: response.data.split("\n")});
            });
        });
        mapkey(';db', '#12Remove bookmark for current page', function() {
            RUNTIME('removeBookmark');
        });
    }
}
