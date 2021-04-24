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

      super._init(0.0, null, false)

      const icon = new St.Icon({
        icon_name:   'system-run-symbolic',
        style_class: 'system-status-icon'
      })

      this.add_actor(icon)
      this.menu.connect('open-state-changed', () => this._refresh())

      this._refresh()
    }

    _refresh() {
      this.menu.removeAll()

      const entries     = this._settings.get_strv('systemd')
      const showAdd     = this._settings.get_boolean('show-add')
      const showRestart = this._settings.get_boolean('show-restart')
      const cmdMethod   = this._settings.get_enum('command-method')

      entries.forEach(data => {
        const entry  = JSON.parse(data)
        const active = Utils.isServiceActive(entry.type, entry.service)
        const widget = new PopupServiceItem(entry.name, active, showRestart)

        this.menu.addMenuItem(widget)

        widget.connect('toggled', () => {
          const action = active ? 'stop' : 'start'
          Utils.runServiceAction(cmdMethod, action, entry.type, entry.service)
        })

        widget.connect('restarted', () => {
          Utils.runServiceAction(cmdMethod, 'restart', entry.type, entry.service)
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
