import GObject from 'gi://GObject'
import St from 'gi://St'
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js'
import * as Main from 'resource:///org/gnome/shell/ui/main.js'
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js'
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js'
import * as Utils from './utils.js'
import { PopupServiceItem, PopupSettingsItem } from './widgets.js'

class SystemdManager extends PanelMenu.Button {
  static {
    GObject.registerClass(this)
  }

  constructor(ext) {
    super(0.2, null, false)

    this._settings = ext.getSettings()
    this._settings.connect('changed', () => this.refresh(ext))

    const icon = new St.Icon({
      icon_name:   'system-run-symbolic',
      style_class: 'system-status-icon'
    })

    this.add_actor(icon)
    this.refresh(ext)

    this.menu.connect('open-state-changed', () => {
      if (this.menu.isOpen) {
        this.refresh(ext)
      }
    })
  }

  refresh(ext) {
    this.menu.removeAll()

    const entries     = this._settings.get_strv('systemd')
    const showAdd     = this._settings.get_boolean('show-add')
    const showRestart = this._settings.get_boolean('show-restart')
    const showMask    = this._settings.get_boolean('show-mask')
    const cmdMethod   = this._settings.get_enum('command-method')

    const services    = entries.map(data => JSON.parse(data))
    const fetchStates = (type, flag) => Utils.getServicesState(
      type, flag, services.filter(ob => ob.type == type).map(ob => ob.service)
    )

    const stateTypes    = ['system', 'user']
    const activeStates  = stateTypes.reduce(
      (all, type) => ({ ...all, [type]: fetchStates(type, 'is-active') }), {}
    )

    const enabledStates = stateTypes.reduce(
      (all, type) => ({...all, [type]: fetchStates(type, 'is-enabled')}), {}
    )

    services.forEach(({ type, name, service }) => {
      const isActive  = activeStates[type][service]
      const isEnabled = enabledStates[type][service]

      const entry = new PopupServiceItem(name, { isActive, isEnabled, showRestart, showMask })
      this.menu.addMenuItem(entry)

      entry.connect('toggled', (actor, active) => {
        const action = active ? 'start' : 'stop'
        Utils.runServiceAction(cmdMethod, action, type, service)
      })

      entry.connect('restarted', () => {
        Utils.runServiceAction(cmdMethod, 'restart', type, service)
        this.menu.close()
      })

      entry.connect('mask-toggled', (actor, masked) => {
        const action = masked ? 'unmask' : 'mask'
        Utils.runServiceAction(cmdMethod, action, type, service)

        this.menu.close()
      })
    })

    if (showAdd && entries.length > 0) {
      const separator = new PopupMenu.PopupSeparatorMenuItem()
      this.menu.addMenuItem(separator)
    }

    if (showAdd) {
      const settings = new PopupSettingsItem(ext, 'Add services')
      this.menu.addMenuItem(settings)
    }
  }
}

export default class SystemdManagerExtension extends Extension {
  enable() {
    this.button = new SystemdManager(this)
    Main.panel.addToStatusArea('systemdManager', this.button)
  }

  disable() {
    this.button?.destroy()
    this.button = null
  }
}
