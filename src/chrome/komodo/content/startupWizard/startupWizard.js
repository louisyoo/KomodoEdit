const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

(function() {
    var log = require("ko/logging").getLogger("startupWizard");
    log.setLevel(10);
    
    var $ = require("ko/dom");
    var prefs = require("ko/prefs");
    var platform = require("sdk/system").platform;
    
    var fields = {};

    this.init = () =>
    {
        this.createFields();
        
        var wizard = $("<wizard>").attr("flex", "1");
        wizard.append(this.getPageUI().$element);
        wizard.append(this.getPageEditor().$element);
        
        wizard.on("wizardcancel", this.onCancel);
        wizard.on("wizardfinish", this.onFinish);
        wizard.on("wizardnext", this.onNext);
        
        $("window").append(wizard);
        
        this.loadSample();
    };
    
    this.createFields = () =>
    {
        fields.keybinding = this.getFieldKeybindings();
        fields.browser = this.getFieldBrowsers();
        fields.colorScheme = this.getFieldColorSchemes();
        
        fields.classicMode = require("ko/ui/checkbox").create("I don't like changes");
        fields.classicMode.checked( prefs.getBoolean("ui.classic.mode") );
        
        fields.classicMode.onChange(() =>
        {
            if (fields.classicMode.checked())
            {
                fields.nativeBorders.checked(true);
                fields.colorScheme.value("Classic");
                fields.keybinding.value("Legacy");
            }
            else
            {
                fields.nativeBorders.checked(false);
            }
        });
        
        fields.nativeBorders = require("ko/ui/checkbox").create("Use native window borders");
        fields.nativeBorders.checked( ! prefs.getBoolean("ui.hide.chrome") );
        
        fields.minimap = require("ko/ui/checkbox").create("Use code minimap");
        fields.minimap.checked( prefs.getBoolean("editShowMinimap") );
        
        fields.taborspace = require("ko/ui/checkbox").create("Prefer tabs over spaces for indentation");
        fields.taborspace.checked( prefs.getBoolean("useTabs") );
        
        fields.wrapping = require("ko/ui/checkbox").create("Wrap long lines");
        fields.wrapping.checked( !! prefs.getLong("editWrapType") );
        
        fields.autoDelimiters = require("ko/ui/checkbox").create("Wrap selection with typed delimiters (eg. quotes)");
        fields.autoDelimiters.checked( prefs.getBoolean("editSmartWrapSelection") );
        
        fields.autofill = require("ko/ui/checkbox").create("Automatically pick code completions using delimiters");
        fields.autofill.checked( prefs.getBoolean("codeintel_completion_auto_fillups_enabled") );
        
        fields.softchars = require("ko/ui/checkbox").create("Automatically insert ending delimiters and tags");
        fields.softchars.checked( prefs.getBoolean("codeintelAutoInsertEndTag") );
        
        fields.showLineNumbers = require("ko/ui/checkbox").create("Show line numbers in Editor");
        fields.showLineNumbers.value( prefs.getBoolean("showLineNumbers") );
        
        fields.indentWidth = require("ko/ui/textbox").create({attributes: { type: "number", min: 1, max: 16, width: 60, maxlength: 2 }});
        fields.indentWidth.value( prefs.getLong("tabWidth") );
        
        fields.snippetBehavior = require("ko/ui/radiogroup").create(
            "Snippet Behaviour: ",
        [
            { attributes: {
                label: "Trigger automatically while typing",
                value: "auto"
            }},
            { attributes: {
                label: "Insert using TAB key",
                value: "tab"
            }}
        ]);
        
        fields.snippetBehavior.value("auto"); // This is hard to detect given the way this is currently stored
    };
    
    this.getFieldKeybindings = () =>
    {
        var currentScheme = prefs.getString("keybinding-scheme");
        var schemes = [];
        var keybindingService =  Cc['@activestate.com/koKeybindingSchemeService;1'].getService();
        keybindingService.getSchemeNames(schemes, {});
        
        schemes = schemes.value;
        var menulist = require("ko/ui/menulist").create();
        
        for (let scheme of schemes)
        {
            menulist.addMenuItem({ attributes: {
                label: scheme,
                selected: scheme == currentScheme
            } });
        }
        
        return menulist;
    };
    
    this.getFieldBrowsers = () =>
    {
        var currentBrowser = prefs.getString('selectedbrowser', '');
        var koWebbrowser = Components.classes['@activestate.com/koWebbrowser;1'].
                       getService(Components.interfaces.koIWebbrowser);
        var knownBrowsers = koWebbrowser.get_possible_browsers({});
        
        var menulist = require("ko/ui/menulist").create();
        menulist.addMenuItem({ attributes: {
            label: platform == "WINNT" ? "System defined default browser" : "Ask when browser is launched the next time",
            value: "",
            selected: currentBrowser === ""
        } });
        
        for (let browser of knownBrowsers)
        {
            menulist.addMenuItem({ attributes: {
                label: browser,
                selected: browser == currentBrowser
            } });
        }
        
        return menulist;
    };
    
    this.getFieldColorSchemes = () =>
    {
        var currentScheme = prefs.getString("editor-scheme");
        var schemeService = Cc['@activestate.com/koScintillaSchemeService;1'].getService();
        var schemes = [];
        schemeService.getSchemeNames(schemes, {});
        schemes = schemes.value;
        
        var menulist = require("ko/ui/menulist").create();
        for(let scheme of schemes)
        {
            let s = schemeService.getScheme(scheme);
            
            menulist.addMenuItem({
                attributes: {
                    label: scheme,
                    css: {
                        "font-family":  s.getCommon("default_fixed", "face"),
                        "color":        s.getCommon("default_fixed", "fore"),
                        "background":   s.getCommon("default_fixed", "back")
                    },
                    isDark: s.isDarkBackground,
                    selected: scheme == currentScheme
                }
            });
        }

        // sort by dark scheme
        menulist.menupopup.$element.children().each(function ()
        {
            if (this.getAttribute("isDark") == "true")
            {
                while (this.previousSibling && this.previousSibling.getAttribute("isDark") != "true") {
                    this.parentNode.insertBefore(this, this.previousSibling);
                }
            }
        });
        
        return menulist;
    };
    
    this.getPageUI = () =>
    {
        var page = require("ko/ui/wizardpage").create();
        
        var appearanceGroupbox = page.addGroupbox({caption: "Appearance"});
        var integrationGroupbox = page.addGroupbox({caption: "Integration"});
        
        // Color scheme
        appearanceGroupbox.addRow([
            require("ko/ui/label").create("Color Scheme: "),
            fields.colorScheme
        ]);
        fields.colorScheme.onChange(this.loadSample);
        
        appearanceGroupbox.addRow($("#sample-stack"));
        
        // I don't like changes
        appearanceGroupbox.addRow(fields.classicMode);
        
        // Native window borders
        appearanceGroupbox.addRow(fields.nativeBorders);
        
        // Minimap
        appearanceGroupbox.addRow(fields.minimap);
        
        // Key bindings
        integrationGroupbox.addRow([
            require("ko/ui/label").create("Key Bindings: "),
            fields.keybinding
        ]);
        
        // Browser
        integrationGroupbox.addRow([
            require("ko/ui/label").create("Default Browser: "),
            fields.browser
        ]);
        
        return page;
    };
    
    this.getPageEditor = () =>
    {
        var page = require("ko/ui/wizardpage").create();
        
        var indentGroupbox = page.addGroupbox({caption: "Indentation"});
        var autoGroupbox = page.addGroupbox({caption: "Automation"});
        
        indentGroupbox.addRow([
            require("ko/ui/label").create("Indentation Width: "),
            fields.indentWidth
        ]);
        
        indentGroupbox.addRow(fields.taborspace);
        
        autoGroupbox.addRow(fields.snippetBehavior);
        
        autoGroupbox.addRow(fields.autofill);
        
        autoGroupbox.addRow(fields.softchars);
        
        autoGroupbox.addRow(fields.autoDelimiters);
        
        autoGroupbox.addRow(fields.showLineNumbers);
                
        return page;
    };
    
    this.loadSample = () =>
    {
        var sample = $('#sample');
        
        if ( ! ("initialized" in this.loadSample))
        {
            scintillaOverlayOnLoad();
            
            var view = sample.element();
            sample.element().initWithBuffer("", "Text");
            
            var scimoz = sample.element().scimoz;
            for (var i=0; i <= scimoz.SC_MAX_MARGIN; i++) 
                scimoz.setMarginWidthN(i, 0);
            
            scimoz.wrapMode = 1;
            scimoz.readOnly = 1;
                
            this.loadSample.initialized = true;
            
            var languageRegistry = Cc["@activestate.com/koLanguageRegistryService;1"].getService(Ci.koILanguageRegistryService);
            var sampleText = languageRegistry.getLanguage("Python").sample;
            view.setBufferText(sampleText);
            view.language = "Python";
        }
        
        var schemeService = Cc['@activestate.com/koScintillaSchemeService;1'].getService();
        var scintilla = sample.element().scimoz;
        var encoding = 'unused';
        var alternateType = false;
        var scheme = schemeService.getScheme(fields.colorScheme.value());
        scheme.applyScheme(scintilla, "Python", encoding, alternateType);
    };
    
    this.onFinish = () =>
    {
        var koCS = require("ko/colorscheme");
        
        prefs.setString("widget-scheme", fields.colorScheme.value());
        
        koCS.applyEditor(fields.colorScheme.value());
        koCS.applyInterface(fields.colorScheme.value(), true);
        
        prefs.setString("keybinding-scheme", fields.keybinding.value());
        prefs.setString("selectedbrowser", fields.browser.value());
        prefs.setBoolean("ui.classic.mode", fields.classicMode.checked());
        prefs.setBoolean("ui.classic.toolbar", fields.classicMode.checked());
        prefs.setBoolean("ui.hide.chrome", ! fields.nativeBorders.checked());
        prefs.setBoolean("editShowMinimap", fields.minimap.checked());
        prefs.setBoolean("useTabs", fields.taborspace.checked());
        prefs.setLong("editWrapType", fields.wrapping.checked() ? 2 : 0);
        prefs.setBoolean("editSmartWrapSelection", fields.autoDelimiters.checked());
        prefs.setBoolean("codeintel_completion_auto_fillups_enabled", fields.autofill.checked());
        prefs.setBoolean("showLineNumbers", fields.showLineNumbers.checked());
        prefs.setBoolean("codeintelAutoInsertEndTag", fields.softchars.checked());
        prefs.setBoolean("editSmartSoftCharacters", fields.softchars.checked());
        prefs.setLong("tabWidth", fields.indentWidth.value());
        prefs.setLong("indentWidth", fields.indentWidth.value());
        
        prefs.setBoolean("enableAutoAbbreviations", true);
        if (fields.snippetBehavior.value() == "auto")
            prefs.deletePref("autoAbbreviationTriggerCharacters");
        else
            prefs.setString("autoAbbreviationTriggerCharacters", "\\t");
        
        return true;
    };
    
    this.onCancel = () =>
    {
        window.dispatchEvent(new Event('wizardfinish'));
        return true;
    };
    
    this.onNext = () =>
    {
        return true;
    };
    
    window.addEventListener("load", this.init);

})();