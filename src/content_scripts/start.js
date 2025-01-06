import { RUNTIME } from './common/runtime.js';
import {
    setSanitizedContent,
} from './common/utils.js';
import { marked } from 'marked';

document.addEventListener("surfingkeys:userSettingsLoaded", function(evt) {
    const { getUsage } = evt.detail;
    getUsage(function(usage) {
        var _usage = document.getElementById('sk_usage');
        setSanitizedContent(_usage, usage);
        var keys = Array.from(_usage.querySelectorAll('div')).filter(function(d) {
            return d.firstElementChild.matches(".kbd-span");
        });
        var randomTip = document.getElementById("randomTip");
        setInterval(function() {
            var i = Math.floor(Math.random()*100000%keys.length);
            var cl = randomTip.classList;
            cl.remove("fadeOut");
            cl.remove("fadeIn");
            cl.add("fadeOut");
            randomTip.one('animationend', function() {
                setSanitizedContent(this, keys[i].innerHTML);
                this.classList.add("fadeIn");
            });
        }, 5000);
    });
});
