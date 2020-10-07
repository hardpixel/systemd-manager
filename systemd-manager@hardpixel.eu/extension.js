const GLib             = imports.gi.GLib
const GObject          = imports.gi.GObject
const Main             = imports.ui.main
const PanelMenu        = imports.ui.panelMenu
const PopupMenu        = imports.ui.popupMenu
const St               = imports.gi.St
const Config           = imports.misc.config
const Util             = imports.misc.util
const ExtensionUtils   = imports.misc.extensionUtils
const SystemdExtension = ExtensionUtils.getCurrentExtension()
const Convenience      = SystemdExtension.imports.convenience
const PopupServiceItem = SystemdExtension.imports.popupServiceItem.PopupServiceItem

const VERSION = parseInt(Config.PACKAGE_VERSION.split('.')[1])

const SystemdManager = GObject.registerClass(
  class SystemdManager extends PanelMenu.Button {
    _init() {
      this._entries  = []
      this._settings = Convenience.getSettings()
      this._settings.connect('changed', () => this._loadConfig())

      super._init(0.0, null, false)

      this.icon = new St.Icon({
        icon_name:   'system-run-symbolic',
        style_class: 'system-status-icon'
      })

      this.add_actor(this.icon)
      this.menu.connect('open-state-changed', () => this._refresh())

      this._loadConfig()
      this._refresh()
    }

    _getCommand(service, action, type) {
      let method  = this._settings.get_enum('command-method')
      let command = `systemctl ${action} ${service} --${type}`

      if ((type == 'system' && action != 'is-active') && method == 0)
        command = `pkexec --user root ${command}`

      return `sh -c "${command} exit"`
    }

    _refresh() {
      this.menu.removeAll()

      let showAdd     = this._settings.get_boolean('show-add')
      let showRestart = this._settings.get_boolean('show-restart')

      this._entries.forEach(service => {
        let cmd = this._getCommand(service.service, 'is-active', service.type)
        let [_, out, err, stat] = GLib.spawn_command_line_sync(cmd)

        let active = stat == 0

        let serviceItem = new PopupServiceItem(service.name, active, {
          restartButton: showRestart
        })

        this.menu.addMenuItem(serviceItem.widget)

        serviceItem.widget.connect('toggled', () => {
          let act = active ? 'stop' : 'start'
          let cmd = this._getCommand(service.service, act, service.type)

          GLib.spawn_command_line_async(cmd)
        })

        if (serviceItem.restartButton) {
          serviceItem.restartButton.connect('clicked', () => {
            let cmd = this._getCommand(service.service, 'restart', service.type)
            GLib.spawn_command_line_async(cmd)

            this.menu.close()
          })
        }
      })

      if (showAdd) {
        if (this._entries.length > 0) {
          let separator = new PopupMenu.PopupSeparatorMenuItem()
          this.menu.addMenuItem(separator)
        }

        let item = new PopupMenu.PopupMenuItem('Add services')
        this.menu.addMenuItem(item)

        item.connect('activate', () => {
          if (ExtensionUtils.openPrefs) {
            ExtensionUtils.openPrefs()
          } else if (VERSION > 34) {
            Util.spawn(['gnome-extensions', 'prefs', SystemdExtension.uuid])
          } else {
            Util.spawn(['gnome-shell-extension-prefs', SystemdExtension.uuid])
          }

          this.menu.close()
        })
      }
    }

    _loadConfig() {
      let entries   = this._settings.get_strv('systemd')
      this._entries = []

      entries.forEach(entryData => {
        let entry  = JSON.parse(entryData)
        entry.type = entry.type || 'system'

        this._entries.push(entry)
      })
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
