import Adw from 'gi://Adw'
import GObject from 'gi://GObject'
import Gtk from 'gi://Gtk'
import Gdk from 'gi://Gdk'
import Gio from 'gi://Gio'
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js'
import * as Utils from './utils.js'

const SERVICE_TYPES   = ['system', 'user']
const DEFAULT_BINDING = Gio.SettingsBindFlags.DEFAULT

class SystemdManager {

  constructor(prefs) {
    this._settings = prefs.getSettings()

    const provider = new Gtk.CssProvider()
    provider.load_from_path(`${prefs.path}/settings.css`)

    Gtk.StyleContext.add_provider_for_display(
      Gdk.Display.get_default(),
      provider,
      Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
    )

    this._buildable = new Gtk.Builder()
    this._buildable.add_from_file(`${prefs.path}/settings.ui`)

    this.bindBoolean('show-add')
    this.bindBoolean('show-restart')
    this.bindEnum('command-method')
    this.bindBoolean('show-mask')

    this.connectEvent('services_selection', 'changed', this._onServiceSelect)
    this.connectEvent('service_up', 'clicked', this._onServiceMoveUp)
    this.connectEvent('service_down', 'clicked', this._onServiceMoveDown)
    this.connectEvent('service_remove', 'clicked', this._onServiceRemove)
    this.connectEvent('service_add', 'clicked', this._onServiceAdd)
    this.connectEvent('services_add_completion', 'match-selected', this._onServiceComplete)

    this.updateAvailableServices()
    this.updateServicesList()
  }

  getObject(name) {
    return this._buildable.get_object(name)
  }

  getInput(setting) {
    return this.getObject(setting.replace(/-/g, '_'))
  }

  bindInput(setting, prop) {
    const widget = this.getInput(setting)
    this._settings.bind(setting, widget, prop, DEFAULT_BINDING)
  }

  bindEnum(setting) {
    const widget = this.getInput(setting)
    widget.set_active(this._settings.get_enum(setting))

    widget.connect('changed', input => {
      this._settings.set_enum(setting, input.get_active())
    })
  }

  bindBoolean(setting) {
    this.bindInput(setting, 'active')
  }

  connectEvent(object, name, callback) {
    const widget = this.getObject(object)
    widget.connect(name, callback.bind(this))
  }

  showWarning(text) {
    const dialog = new Gtk.MessageDialog({
      title:        'Warning',
      text:         text,
      modal:        true,
      buttons:      Gtk.ButtonsType.OK,
      message_type: Gtk.MessageType.WARNING
    })

    dialog.connect('response', () => dialog.close())
    dialog.show()
  }

  trimParameter(name) {
    if (name.includes('@')) {
      return name.split('@')[0] + '@.service'
    } else {
      return name
    }
  }

  isValidService(name) {
    const service = this.trimParameter(name)
    return this.availableServices.all.includes(service)
  }

  getServiceType(name) {
    const service = this.trimParameter(name)
    const newType = this._newEntryType
    const newList = newType && this.availableServices[newType]

    if (newList && newList.includes(service)) {
      return newType
    }

    if (this.availableServices.system.includes(service)) {
      return 'system'
    }

    if (this.availableServices.user.includes(service)) {
      return 'user'
    }
  }

  updateAvailableServices() {
    const store = this.getObject('services_add_completion_model')
    store.clear()

    this.availableServices = { 'all': [] }

    SERVICE_TYPES.forEach(type => {
      const services = Utils.getServicesList(type)

      this.availableServices[type] = services
      this.availableServices.all.push(...services)

      services.forEach(service => {
        const iter = store.append()
        store.set(iter, [0, 1], [service, type])
      })
    })
  }

  updateServicesList() {
    const store = this.getObject('services_list_model')
    store.clear()

    const current = this._settings.get_strv('systemd')
    const updated = current.reduce((items, item) => {
      const entry = JSON.parse(item)

      if (this.isValidService(entry.service)) {
        items.push(JSON.stringify(entry))

        const iter = store.append()
        store.set(iter, [0, 1, 2], [entry.name, entry.service, entry.type])
      }

      return items
    }, [])

    this._settings.set_strv('systemd', updated)
  }

  getServiceFromIter(iter) {
    const store   = this.getObject('services_list_model')
    const name    = store.get_value(iter, 0)
    const service = store.get_value(iter, 1)
    const type    = store.get_value(iter, 2)

    return { name, service, type }
  }

  getSelectedService() {
    const selection = this.getObject('services_selection')
    const [any, store, iter] = selection.get_selected()

    const items = this._settings.get_strv('systemd')
    const service = any && this.getServiceFromIter(iter)
    const index = service ? items.indexOf(JSON.stringify(service)) : -1

    return [index, items, store, iter]
  }

  _onServiceSelect() {
    const toolbar   = this.getObject('services_toolbar')
    const selection = this.getObject('services_selection')

    toolbar.set_sensitive(selection.count_selected_rows() > 0)
  }

  _onServiceMove(offset) {
    const [index, items, store, iter] = this.getSelectedService()
    if (index < 0 || index >= items.length) return

    items.splice(index + offset, 0, items.splice(index, 1)[0])
    this._settings.set_strv('systemd', items)

    const current = iter.copy()

    if (offset < 0) {
      store.iter_previous(iter)
      store.move_before(current, iter)
    } else {
      store.iter_next(iter)
      store.move_after(current, iter)
    }
  }

  _onServiceMoveUp() {
    this._onServiceMove(-1)
  }

  _onServiceMoveDown() {
    this._onServiceMove(1)
  }

  _onServiceRemove() {
    const [index, items, store, iter] = this.getSelectedService()
    if (index < 0) return

    items.splice(index, 1)
    this._settings.set_strv('systemd', items)

    store.remove(iter)
  }

  _onServiceComplete(comp, model, iter) {
    this._newEntryType = model.get_value(iter, 1)
  }

  _onServiceAdd() {
    const nameEntry = this.getObject('add_service_label')
    const unitEntry = this.getObject('add_service_unit')

    const name    = nameEntry.get_text().trim()
    const service = unitEntry.get_text().trim()
    const type    = this.getServiceType(service)

    if (!name.length || !service.length) {
      this.showWarning('No label and/or service specified')
      return
    }

    if (!this.isValidService(service) || !type) {
      this.showWarning('Service does not exist')
      return
    }

    const id    = JSON.stringify({ name, service, type })
    const items = this._settings.get_strv('systemd')
    const index = items.indexOf(id)
    const store = this.getObject('services_list_model')

    if (index < 0) {
      items.push(id)
      this._settings.set_strv('systemd', items)

      const iter = store.append()
      store.set(iter, [0, 1, 2], [name, service, type])
    }

    nameEntry.set_text('')
    unitEntry.set_text('')

    this._newEntryType = null
  }
}

export default class SystemdManagerPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const manager = new SystemdManager(this)

    window.add(manager.getObject('services_page'))
    window.add(manager.getObject('settings_page'))

    window.set_default_size(620, 680)
  }
}
