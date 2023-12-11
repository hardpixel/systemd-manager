import St from 'gi://St'
import GObject from 'gi://GObject'
import * as Animation from 'resource:///org/gnome/shell/ui/animation.js'
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js'

const LOADING_STATES = ['reloading', 'activating', 'deactivating', 'maintenance']

export class PopupServiceItem extends PopupMenu.PopupSwitchMenuItem {
  static {
    GObject.registerClass({
      Signals: {
        'restarted': {},
        'mask-toggled': { param_types: [GObject.TYPE_BOOLEAN] }
      }
    }, this)
  }

  constructor(text, { isActive, isEnabled, showRestart, showMask }) {
    const loading  = LOADING_STATES.includes(isActive)
    const reactive = loading == false

    const active   = isActive == 'active'
    const failure  = isActive == 'failed'
    const masked   = isEnabled == 'masked'

    super(text, active, { style_class: 'systemd-manager-item' })

    if (failure) {
      this.label.add_style_class_name('systemd-manager-error')
    }

    if (loading) {
      const spinner = new Animation.Spinner(16, {
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

    if (showMask) {
      const icon = new St.Icon({
        icon_name:   masked ? 'security-high-symbolic' : 'security-low-symbolic',
        style_class: 'popup-menu-icon'
      })

      const button = new St.Button({
        x_align:         1,
        reactive:        reactive,
        can_focus:       reactive,
        track_hover:     reactive,
        checked:         masked,
        accessible_name: 'mask',
        style_class:     'system-menu-action systemd-manager-button mask-button',
        child:           icon
      })

      button.connect('clicked', () => this.emit('mask-toggled', masked))
      this.add_child(button)
    }
  }
}

export class PopupSettingsItem extends PopupMenu.PopupMenuItem {
  static {
    GObject.registerClass(this)
  }

  constructor(ext, text) {
    super(text, { style_class: 'systemd-manager-item' })

    this.connect('activate', () => {
      ext.openPreferences()
    })
  }
}
