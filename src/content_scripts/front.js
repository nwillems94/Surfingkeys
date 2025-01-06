import Mode from './common/mode.js';
import {
    createElementWithContent,
    flashPressedLink,
    generateQuickGuid,
    getAnnotations,
    getBrowserName,
    getDocumentOrigin,
    getElements,
    httpRequest,
    initSKFunctionListener,
    isEditable,
    isInUIFrame,
    scrollIntoViewIfNeeded,
    tabOpenLink,
} from './common/utils.js';
import { RUNTIME, dispatchSKEvent, runtime } from './common/runtime.js';
import createUiHost from './uiframe.js';

function createFront(insert, normal, hints, visual, browser) {
    var self = {};
    // The agent is a front stub to talk with pages/frontend.html
    // that will live in all content window except the frontend.html
    // as there is no need to make this object live in frontend.html.

    var _uiUserSettings = [];
    function applyUserSettings() {
        for (var cmd of _uiUserSettings) {
            self.command(cmd);
        }
    }

    var frontendPromise;

    function newFrontEnd() {
        frontendPromise = new Promise(function (resolve, reject) {
            createUiHost(browser, (res) => {
                resolve(res);
                applyUserSettings();
            });
        });
    }

    var _callbacks = {};
    self.command = function(args, successById) {
        args.toFrontend = true;
        args.origin = getDocumentOrigin();
        args.id = generateQuickGuid();
        if (successById) {
            args.ack = true;
            _callbacks[args.id] = successById;
        }
        if (window !== top) {
            runtime.postTopMessage(args);
        } else {
            if (!frontendPromise) {
                // no need to create frontend iframe if the action is to hide key stroke
                // and frontend UI must be created after document.body is ready(#2132)
                if (args.action === "hideKeystroke" || document.body === null) {
                    return;
                }
                newFrontEnd();
            }
            frontendPromise.then(function() {
                runtime.postTopMessage(args);
            });
        }
    };

    function applyUICommand(cmd) {
        _uiUserSettings.push(cmd);
        if (frontendPromise) {
            frontendPromise.then(function() {
                self.command(cmd);
            });
        }
    }

    var _listSuggestions = {};

    var _actions = {};
    var skCallbacks = {};


    self.executeCommand = function (cmd) {
        self.command({
            action: 'executeCommand',
            cmdline: cmd
        });
    };

    var frameElement = createElementWithContent('div', 'Hi, I\'m here now!', {id: "sk_frame"});
    frameElement.fromSurfingKeys = true;
    function highlightElement(sn) {
        document.documentElement.append(frameElement);
        var rect = sn.rect;
        frameElement.style.top = rect.top + "px";
        frameElement.style.left = rect.left + "px";
        frameElement.style.width = rect.width + "px";
        frameElement.style.height = rect.height + "px";
        frameElement.style.display = "";
        setTimeout(function() {
            frameElement.remove();
        }, sn.duration);
    }

    function getAllAnnotations() {
        let mappings = [ normal.mappings,
            visual.mappings,
            insert.mappings
        ];
        const lurk = normal.getLurkMode();
        if (lurk) {
            mappings.unshift(lurk.mappings);
        }
        return mappings.map(getAnnotations).reduce(function(a, b) {
            return a.concat(b);
        });
    }

    self.showUsage = function() {
        self.command({
            action: 'showUsage',
            metas: getAllAnnotations()
        });
    };

    self.getUsage = function(cb) {
        self.command({
            action: 'getUsage',
            metas: getAllAnnotations()
        }, function(response) {
            cb(response.data);
        });
    };

    function hidePopup() {
        self.command({
            action: 'hidePopup'
        });
    }

    function updateElementBehindEditor(data) {
        // setEditorText and setValueWithEventDispatched are experimental APIs from Brook Build of Chromium
        // https://brookhong.github.io/2021/04/18/brook-build-of-chromium.html
        if (elementBehindEditor.nodeName === "DIV") {
            if (elementBehindEditor.className === "CodeMirror-code") {
                window.getSelection().selectAllChildren(elementBehindEditor)
                let dataTransfer = new DataTransfer()
                dataTransfer.items.add(data, 'text/plain')
                elementBehindEditor.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dataTransfer}))
            } else {
                data = data.replace(/\n+$/, '');

                if (typeof elementBehindEditor.setEditorText === "function") {
                    elementBehindEditor.setEditorText(data);
                } else {
                    elementBehindEditor.innerText = data;
                }
            }
        } else {
            if (typeof elementBehindEditor.setValueWithEventDispatched === "function") {
                elementBehindEditor.setValueWithEventDispatched(data);
            } else {
                elementBehindEditor.value = data;
                var evt = document.createEvent("HTMLEvents");
                evt.initEvent("change", false, true);
                elementBehindEditor.dispatchEvent(evt);
            }
        }
    }

    var elementBehindEditor;

    self.chooseTab = function() {
        if (normal.repeats !== "") {
            RUNTIME('focusTabByIndex');
        } else {
            self.command({
                action: 'chooseTab'
            });
        }
    };

    var _keyHints = {
        accumulated: "",
        candidates: {},
        key: ""
    };

    self.showStatus = function (msgs, duration) {
        self.command({
            action: "showStatus",
            contents: msgs,
            duration: duration
        });
    };
    self.toggleStatus = function (visible) {
        self.command({
            action: "toggleStatus",
            visible: visible
        });
    };

    skCallbacks = initSKFunctionListener("front", {
        showPopup: (content) => {
            self.command({
                action: 'showPopup',
                content: content
            });
        },
        applySettingsFromSnippets: (us) => {
            applyUICommand({
                action: 'applyUserSettings',
                userSettings: us
            });
            const cloneUS = JSON.parse(JSON.stringify(us));
            // overrides local settings from snippets
            for (var k in cloneUS) {
                if (runtime.conf.hasOwnProperty(k)) {
                    runtime.conf[k] = cloneUS[k];
                    delete cloneUS[k];
                }
            }
            if (Object.keys(cloneUS).length > 0 && window === top) {
                // left settings are for background, need not broadcast the update, neither persist into storage
                RUNTIME('updateSettings', {
                    scope: "snippets",
                    settings: cloneUS
                });
            }
            dispatchSKEvent('settingsFromSnippetsLoaded');
        },
        addMapkey: (mode, new_keystroke, old_keystroke) => {
            applyUICommand({
                action: 'addMapkey',
                mode: mode,
                new_keystroke: new_keystroke,
                old_keystroke: old_keystroke
            });
        },
        addVimMap: (lhs, rhs, ctx) => {
            applyUICommand({
                action: 'addVimMap',
                lhs: lhs,
                rhs: rhs,
                ctx: ctx
            });
        },
        addVimKeyMap: (vimKeyMap) => {
            applyUICommand({
                action: 'addVimKeyMap',
                vimKeyMap
            });
        },
        highlightElement,
        hidePopup,
        openFinder: () => {
            self.command({
                action: "openFinder"
            });
        },
        showBanner: (msg, linger_time) => {
            self.command({
                action: "showBanner",
                content: msg,
                linger_time: linger_time
            });
        },
        showBubble: (pos, msg, noPointerEvents) => {
            if (msg.length > 0) {
                pos.winWidth = window.innerWidth;
                pos.winHeight = window.innerHeight;
                pos.winX = 0;
                pos.winY = 0;
                if (window.frameElement) {
                    pos.winX = window.frameElement.offsetLeft;
                    pos.winY = window.frameElement.offsetTop;
                }
                self.command({
                    action: "showBubble",
                    content: msg,
                    position: pos,
                    noPointerEvents: noPointerEvents
                });
            }
        },
        hideBubble: () => {
            self.command({
                action: 'hideBubble'
            });
        },
        hideKeystroke: () => {
            _keyHints.accumulated = "";
            _keyHints.candidates = {};
            self.command({
                action: 'hideKeystroke'
            });
        },
        showKeystroke: (key, mode) => {
            _keyHints.accumulated += key;
            _keyHints.key = key;
            _keyHints.candidates = {};

            var root = mode.mappings.find(_keyHints.accumulated);
            if (root) {
                root.getMetas(function(m) {
                    return true;
                }).forEach(function(m) {
                    _keyHints.candidates[m.word] = {
                        annotation: m.annotation
                    };
                });
            }

            self.command({
                action: 'showKeystroke',
                keyHints: _keyHints
            });
        },
        showStatus: self.showStatus,
        toggleStatus: self.toggleStatus,
    });

    _actions["ace_editor_saved"] = function(response) {
        if (response.data !== undefined) {
            onEditorSaved(response.data);
        }
        if (runtime.conf.focusOnSaved && isEditable(elementBehindEditor)) {
            normal.passFocus(true);
            elementBehindEditor.focus();
            insert.enter(elementBehindEditor);
        }
    };
    _actions["nextEdit"] = function(response) {
        var sel = hints.getSelector() || "input, textarea, *[contenteditable=true], select";
        sel = getElements(sel);
        if (sel.length) {
            var i = sel.indexOf(elementBehindEditor);
            i = (i + (response.backward ? -1 : 1)) % sel.length;
            sel = sel[i];
            scrollIntoViewIfNeeded(sel);
            flashPressedLink(sel, () => {
                self.showEditor(sel);
            });
        }
    };


    _actions["getBackFocus"] = function(response) {
        window.focus();
        if (window === top && frontendPromise) {
            frontendPromise.then((uiHost) => {
                if (uiHost.shadowRoot.contains(document.activeElement)) {
                    // fix for Firefox, blur from iframe for frontend after Omnibar closed.
                    document.activeElement.blur();
                }
            });
        }
    };

    _actions["getPageText"] = function(response) {
        return document.body.innerText;
    };

    var _pendingQuery;
    function clearPendingQuery() {
        if (_pendingQuery) {
            clearTimeout(_pendingQuery);
            _pendingQuery = undefined;
        }
    }

    _actions["visualUpdate"] = function(message) {
        clearPendingQuery();
        _pendingQuery = setTimeout(function() {
            visual.visualUpdate(message.query);
            self.command({
                action: "visualUpdated"
            });
        }, 500);
    };

    _actions["visualClear"] = function(message) {
        clearPendingQuery();
        visual.visualClear();
    };

    _actions["visualEnter"] = function(message) {
        clearPendingQuery();
        visual.visualEnter(message.query);
    };

    _actions["emptySelection"] = function(message) {
        visual.emptySelection();
    };

    var _active = window === top;
    _actions['deactivated'] = function(message) {
        _active = false;
    };

    _actions['activated'] = function(message) {
        _active = true;
    };

    runtime.on('focusFrame', function(msg, sender, response) {
        if (msg.frameId === window.frameId) {
            window.focus();
            document.body.scrollIntoView({
                behavior: 'auto',
                block: 'center',
                inline: 'center'
            });
            highlightElement({
                duration: 500,
                rect: {
                    top: 0,
                    left: 0,
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            });
        }
    });

    window.addEventListener('message', function (event) {
        var _message = event.data && (event.data.surfingkeys_content_data || event.data.dictorium_data);
        if (_message === undefined) {
            return;
        }
        if (_active) {
            if (_callbacks[_message.id]) {
                var f = _callbacks[_message.id];
                // returns true to make callback stay for coming response.
                if (!f(_message)) {
                    delete _callbacks[_message.id];
                }
            } else if (_message.action && _actions.hasOwnProperty(_message.action)) {
                var ret = _actions[_message.action](_message);
                if (_message.ack && ret) {
                    if (!ret.then) {
                        ret = Promise.resolve(ret);
                    }
                    ret.then((data) =>
                      runtime.postTopMessage({
                          data,
                          toFrontend: true,
                          origin: _message.origin,
                          id: _message.id
                      }));
                }
            }
        } else if (_message.action === "activated") {
            _actions['activated'](_message);
        } else if (_message.type === "DictoriumViewReady") {
            // make inline query also work on dictorium frame continuously
            _actions['activated'](_message);
        }
        if (!event.data.dictorium_data) {
            event.stopImmediatePropagation();
        }
    }, true);

    var uiHostDetaching;
    self.attach = function() {
        if (uiHostDetaching) {
            clearTimeout(uiHostDetaching);
            uiHostDetaching = undefined;
        }
        if (!frontendPromise) {
            newFrontEnd();
        }
    };

    self.detach = function() {
        if (frontendPromise) {
            frontendPromise.then((uiHost) => {
                uiHostDetaching = setTimeout(function() {
                    uiHost.detach();
                    frontendPromise = undefined;
                }, 3000);
            });
        }
    };

    return self;
}

export default createFront;
