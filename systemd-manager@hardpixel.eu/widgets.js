const St             = imports.gi.St
const GObject        = imports.gi.GObject
const PopupMenu      = imports.ui.popupMenu
const Util           = imports.misc.util
const ExtensionUtils = imports.misc.extensionUtils
const Me             = ExtensionUtils.getCurrentExtension()
const VERSION        = Me.imports.utils.VERSION

var PopupServiceItem = GObject.registerClass({
  Signals: {
    'restarted': {}
  }
}, class PopupServiceItem extends PopupMenu.PopupSwitchMenuItem {
    _init(text, active, showRestart) {
      super._init(text, active, { style_class: 'systemd-manager-item' })

      if (showRestart) {
        const icon = new St.Icon({
          icon_name:   'view-refresh-symbolic',
          style_class: 'popup-menu-icon'
        })

        const button = new St.Button({
          x_align:         1,
          reactive:        true,
          can_focus:       true,
          track_hover:     true,
          accessible_name: 'restart',
          style_class:     'system-menu-action systemd-manager-button',
          child:           icon
        })

        button.connect('clicked', () => this.emit('restarted'))
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
