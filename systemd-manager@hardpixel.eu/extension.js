const GObject           = imports.gi.GObject
const Main              = imports.ui.main
const PanelMenu         = imports.ui.panelMenu
const PopupMenu         = imports.ui.popupMenu
const St                = imports.gi.St
const Me                = imports.misc.extensionUtils.getCurrentExtension()
const Convenience       = Me.imports.convenience
const PopupServiceItem  = Me.imports.widgets.PopupServiceItem
const PopupSettingsItem = Me.imports.widgets.PopupSettingsItem
const Utils             = Me.imports.utils

const SystemdManager = GObject.registerClass(
  class SystemdManager extends PanelMenu.Button {
    _init() {
      this._settings = Convenience.getSettings()
      this._settings.connect('changed', () => this._refresh())

      super._init(0.2, null, false)

      const icon = new St.Icon({
        icon_name:   'system-run-symbolic',
        style_class: 'system-status-icon'
      })

      this.add_actor(icon)
      this.refresh()

      this.menu.connect('open-state-changed', () => {
        if (this.menu.isOpen) {
          this.refresh()
        }
      })
    }

    refresh() {
      this.menu.removeAll()

      const entries     = this._settings.get_strv('systemd')
      const showAdd     = this._settings.get_boolean('show-add')
      const showRestart = this._settings.get_boolean('show-restart')
      const cmdMethod   = this._settings.get_enum('command-method')
      const showMask    = this._settings.get_boolean('show-mask')

      const services    = entries.map(data => JSON.parse(data))
      const fetchStates = type => Utils.getServicesState(
        type, services.filter(ob => ob.type == type).map(ob => ob.service)
      )

      const stateTypes  = ['system', 'user']
      const unitStates  = stateTypes.reduce(
        (all, type) => ({ ...all, [type]: fetchStates(type) }), {}
      )
      
      // code taken by  (github username:) @jonian
      const maskedStates = stateTypes.reduce(
        (all, type) => ({...all, [type]: Utils.getMaskedServicesList(type)}), {}
      )

      services.forEach(({ type, name, service }) => {
        const state = unitStates[type][service]
        const maskedState = maskedStates[type].includes(service)
        const entry = new PopupServiceItem(name, state, showRestart, showMask, maskedState)

        this.menu.addMenuItem(entry)


        entry.connect('toggled', (actor, active) => {
          const action = active ? 'start' : 'stop'
          Utils.runServiceAction(cmdMethod, action, type, service)
        })

        entry.connect('restarted', () => {
          Utils.runServiceAction(cmdMethod, 'restart', type, service)
          this.menu.close()
        })


        entry.connect('maskToggle', () => {
          const action = maskedState ? 'unmask' : 'mask'
          Utils.runServiceAction(cmdMethod, action, type, service)
          this.menu.close()
        })
        

      })

      if (showAdd && entries.length > 0) {
        const separator = new PopupMenu.PopupSeparatorMenuItem()
        this.menu.addMenuItem(separator)
      }

      if (showAdd) {
        const settings = new PopupSettingsItem('Add services')
        this.menu.addMenuItem(settings)
      }
    }
  }
)

let servicesManager = null

function enable() {
  servicesManager = new SystemdManager()
  Main.panel.addToStatusArea('systemdManager', servicesManager)
}

function disable() {
  servicesManager.destroy()
  servicesManager = null
}
