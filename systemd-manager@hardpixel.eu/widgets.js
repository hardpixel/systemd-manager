const Atk            = imports.gi.Atk
const St             = imports.gi.St
const GObject        = imports.gi.GObject
const Animation      = imports.ui.animation
const Panel          = imports.ui.panel
const PopupMenu      = imports.ui.popupMenu
const Util           = imports.misc.util
const ExtensionUtils = imports.misc.extensionUtils
const Me             = ExtensionUtils.getCurrentExtension()
const VERSION        = Me.imports.utils.VERSION

const LOADING_STATES = ['reloading', 'activating', 'deactivating', 'maintenance']

var PopupServiceItem = GObject.registerClass({
  Signals: {
    'restarted': {},
    'maskToggle': {}
    //'toggled': {}
  }
}, class PopupServiceItem extends PopupMenu.PopupSwitchMenuItem {
    _init(text, state, showRestart, showMask, maskedState) {
      const loading  = LOADING_STATES.includes(state)
      const active   = state == 'active'
      const reactive = loading == false
      const failure  = state == 'failed'
      /* // const maskedState   = state == 'masked' */

      super._init(text, active, { style_class: 'systemd-manager-item' }, showMask, maskedState)

      if (failure) {
        this.label.add_style_class_name('systemd-manager-error')
      }

      if (loading) {
        const spinner = new Animation.Spinner(Panel.PANEL_ICON_SIZE, {
          animate: true,
          hideOnStop: true
        })

        this.insert_child_above(spinner, this.label)

        this.reactive = false
        spinner.play()
      }

      if (showRestart) {
        const icon = new St.Icon({
          icon_name:   'view-refresh-symbolic',
          style_class: 'popup-menu-icon'
        })

        const button = new St.Button({
          x_align:         1,
          reactive:        reactive,
          can_focus:       reactive,
          track_hover:     reactive,
          accessible_name: 'restart',
          style_class:     'system-menu-action systemd-manager-button',
          child:           icon
        })

        button.connect('clicked', () => this.emit('restarted'))
        this.add_child(button)
      }

      // log('showMask in widgets line 68: ' + showMask)
      if (showMask) {
        /*const icon = new St.Icon({
          icon_name:   'view-mirror-symbolic',
          style_class: 'popup-menu-icon'
        })
        */
        const button = new St.Button({
          x_align:         2,
          // the button must be reactive if-f the widget is reactive and the button's service is active !!
          reactive:        reactive, 
          can_focus:       reactive,
          track_hover:     reactive,
          accessible_name: 'mask',
          style_class:     'system-menu-action toggle-switch',
          // child:           icon
          toggle_mode:     active,
          checked:         maskedState && active
        })

        button.connect('clicked', () => this.emit('maskToggle'))
        this.add_child(button)
        
        
      }

    }
  }
)

var PopupSettingsItem = GObject.registerClass(
  class PopupSettingsItem extends PopupMenu.PopupMenuItem {
    _init(text) {
      super._init(text, { style_class: 'systemd-manager-item' })

      this.connect('activate', () => {
        if (VERSION >= 36) {
          ExtensionUtils.openPrefs()
        } else if (VERSION > 34) {
          Util.spawn(['gnome-extensions', 'prefs', Me.uuid])
        } else {
          Util.spawn(['gnome-shell-extension-prefs', Me.uuid])
        }
      })
    }
  }
)
