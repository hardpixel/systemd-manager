const Lang             = imports.lang;
const GLib             = imports.gi.GLib;
const GObject          = imports.gi.GObject;
const Gtk              = imports.gi.Gtk;
const Gio              = imports.gi.Gio;
const ExtensionUtils   = imports.misc.extensionUtils;
const SystemdExtension = ExtensionUtils.getCurrentExtension();
const Convenience      = SystemdExtension.imports.convenience;


const SystemdManagerSettings = new GObject.Class({
  Name: 'SystemdManagerSettings',
  Extends: Gtk.Notebook,

  _init(params) {
    this._settings = Convenience.getSettings();
    this._settings.connect('changed', Lang.bind(this, this._refresh));

    this._changedPermitted = false;

    this.parent(params);
    this.set_tab_pos(Gtk.PositionType.TOP);
    this.set_show_border(false);

    let servicesPage = new Gtk.Grid();
    servicesPage.set_orientation(Gtk.Orientation.VERTICAL);
    servicesPage.margin = 20;

    let otherPage = new Gtk.Grid();
    otherPage.set_orientation(Gtk.Orientation.VERTICAL);
    otherPage.set_row_spacing(10);
    otherPage.margin = 20;

    this.append_page(servicesPage, new Gtk.Label({ label: 'Services', hexpand: true }))
    this.append_page(otherPage, new Gtk.Label({ label: 'Settings', hexpand: true }))

    let showAddLabel = new Gtk.Label({
      label:   'Show add services',
      xalign:  0,
      hexpand: true
    });

    this._showAddCheckbox = new Gtk.Switch({ halign: 2 });

    this._showAddCheckbox.connect('notify::active', button => {
      this._changedPermitted = false;
      this._settings.set_boolean('show-add', button.active);
      this._changedPermitted = true;
    });

    otherPage.attach(showAddLabel, 1, 1, 1, 1);
    otherPage.attach_next_to(this._showAddCheckbox, showAddLabel, 1, 1, 1);

    let showRestartLabel = new Gtk.Label({
      label:   'Show restart button',
      xalign:  0,
      hexpand: true
    });

    this._showRestartCheckbox = new Gtk.Switch({ halign: 2 });
    this._showRestartCheckbox.connect('notify::active', button => {
      this._changedPermitted = false;
      this._settings.set_boolean('show-restart', button.active);
      this._changedPermitted = true;
    });

    otherPage.attach(showRestartLabel, 1, 2, 1, 1);
    otherPage.attach_next_to(this._showRestartCheckbox, showRestartLabel, 1, 1, 1);

    let positionLabel = new Gtk.Label({
      label:   'Position',
      xalign:  0,
      hexpand: true
    });

    let model = new Gtk.ListStore();
    model.set_column_types([GObject.TYPE_INT, GObject.TYPE_STRING]);

    this._positionCombo = new Gtk.ComboBox({ model: model });
    this._positionCombo.get_style_context().add_class(Gtk.STYLE_CLASS_RAISED);

    let renderer = new Gtk.CellRendererText();
    this._positionCombo.pack_start(renderer, true);
    this._positionCombo.add_attribute(renderer, 'text', 1);

    let positionsItems = [
      { id: 0, name: 'Panel' },
      { id: 1, name: 'Menu'}
    ]

    for (let i = 0; i < positionsItems.length; i++) {
      let item = positionsItems[i];
      let iter = model.append();

      model.set(iter, [0, 1], [item.id, item.name]);
    }

    this._positionCombo.connect('changed', entry => {
      let [success, iter] = this._positionCombo.get_active_iter();

      if (success) {
        this._changedPermitted = false;
        this._settings.set_enum('position', this._positionCombo.get_model().get_value(iter, 0));
        this._changedPermitted = true;
      }
    });

    otherPage.attach(positionLabel, 1, 3, 1, 1);
    otherPage.attach_next_to(this._positionCombo, positionLabel, 1, 1, 1);

    let commandMethodLabel = new Gtk.Label({
      label:   'Command Method',
      xalign:  0,
      hexpand: true
    });

    let commandMethodModel = new Gtk.ListStore();
    commandMethodModel.set_column_types([GObject.TYPE_INT, GObject.TYPE_STRING]);

    this._commandMethodCombo = new Gtk.ComboBox({ model: commandMethodModel });
    this._commandMethodCombo.get_style_context().add_class(Gtk.STYLE_CLASS_RAISED);

    let commandMethodRenderer = new Gtk.CellRendererText();
    this._commandMethodCombo.pack_start(commandMethodRenderer, true);
    this._commandMethodCombo.add_attribute(commandMethodRenderer, 'text', 1);

    let commandMethodsItems = [
      { id: 0, name: 'pkexec' },
      { id: 1, name: 'systemctl' }
    ]

    for (let i = 0; i < commandMethodsItems.length; i++) {
      let item = commandMethodsItems[i];
      let iter = commandMethodModel.append();

      commandMethodModel.set(iter, [0, 1], [item.id, item.name]);
    }

    this._commandMethodCombo.connect('changed', entry => {
      let [success, iter] = this._commandMethodCombo.get_active_iter();

      if (success) {
        this._changedPermitted = false;
        this._settings.set_enum('command-method', this._commandMethodCombo.get_model().get_value(iter, 0));
        this._changedPermitted = true;
      }
    });

    otherPage.attach(commandMethodLabel, 1, 4, 1, 1);
    otherPage.attach_next_to(this._commandMethodCombo, commandMethodLabel, 1, 1, 1);

    let treeViewLabel = new Gtk.Label({
      label:         '<b>Listed Services</b>',
      use_markup:    true,
      halign:        Gtk.Align.START,
      margin_bottom: 10
    });

    servicesPage.add(treeViewLabel);

    this._store = new Gtk.ListStore();
    this._store.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_STRING]);

    this._treeView = new Gtk.TreeView({
      model:   this._store,
      hexpand: true,
      vexpand: true
    });

    let treeFrame = new Gtk.Frame();
    treeFrame.add(this._treeView);
    servicesPage.add(treeFrame);

    let selection = this._treeView.get_selection();
    selection.set_mode(Gtk.SelectionMode.SINGLE);
    selection.connect('changed', Lang.bind(this, this._onSelectionChanged));

    let labelColumn = new Gtk.TreeViewColumn({ expand: true, title: 'Label' });
    let labelRenderer = new Gtk.CellRendererText;

    labelColumn.pack_start(labelRenderer, true);
    labelColumn.add_attribute(labelRenderer, 'text', 0);
    this._treeView.append_column(labelColumn);

    let serviceColumn = new Gtk.TreeViewColumn({ expand: true, title: 'Service' });
    let serviceRenderer = new Gtk.CellRendererText;

    serviceColumn.pack_start(serviceRenderer, true);
    serviceColumn.add_attribute(serviceRenderer, 'text', 1);
    this._treeView.append_column(serviceColumn);

    let typeColumn = new Gtk.TreeViewColumn({ expand: true, title: 'Type' });
    let typeRenderer = new Gtk.CellRendererText;

    typeColumn.pack_start(typeRenderer, true);
    typeColumn.add_attribute(typeRenderer, 'text', 2);
    this._treeView.append_column(typeColumn);

    let toolbar = new Gtk.Toolbar({ hexpand: true });
    toolbar.get_style_context().add_class(Gtk.STYLE_CLASS_INLINE_TOOLBAR);
    servicesPage.add(toolbar);

    let upButton = new Gtk.ToolButton({ stock_id: Gtk.STOCK_GO_UP });
    upButton.connect('clicked', Lang.bind(this, this._up));
    toolbar.add(upButton);

    let downButton = new Gtk.ToolButton({ stock_id: Gtk.STOCK_GO_DOWN });
    downButton.connect('clicked', Lang.bind(this, this._down));
    toolbar.add(downButton);

    let delButton = new Gtk.ToolButton({ stock_id: Gtk.STOCK_DELETE });
    delButton.connect('clicked', Lang.bind(this, this._delete));
    toolbar.add(delButton);

    this._selDepButtons = [upButton, downButton, delButton];

    let gridLabel = new Gtk.Label({
      label:         '<b>Add new Service</b>',
      use_markup:    true,
      halign:        Gtk.Align.START,
      margin_top:    20,
      margin_bottom: 10
    });

    servicesPage.add(gridLabel);

    let grid = new Gtk.Grid({
      column_spacing: 10,
      row_spacing:    10,
      margin:         10
    });

    let gridFrame = new Gtk.Frame();
    gridFrame.add(grid);
    servicesPage.add(gridFrame);

    let labelName = new Gtk.Label({ label: 'Label' });
    labelName.halign = 2;

    this._displayName = new Gtk.Entry({ hexpand: true });
    this._displayName.set_placeholder_text('Name in menu');

    let labelService = new Gtk.Label({ label: 'Service' });
    labelService.halign = 2;

    let sListStore = new Gtk.ListStore();
    sListStore.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_STRING]);

    let types = ['system', 'user'];

    this._availableSystemdServices = { 'all': [] };

    for (let t in types) {
      let type = types[t];

      this._availableSystemdServices[type]  = this._getSystemdServicesList(type);
      this._availableSystemdServices['all'] = this._availableSystemdServices['all'].concat(this._availableSystemdServices[type]);

      for (let i in this._availableSystemdServices[type]) {
        let name = this._availableSystemdServices[type][i] + ' ' + type;
        sListStore.set(sListStore.append(), [0, 1, 2], [name, this._availableSystemdServices[type][i], type]);
      }
    }

    this._systemName = new Gtk.Entry({ hexpand: true });
    this._systemName.set_placeholder_text('Systemd service name and type');

    let completion = new Gtk.EntryCompletion();
    this._systemName.set_completion(completion);
    completion.set_model(sListStore);

    completion.set_text_column(0)

    grid.attach(labelName, 1, 1, 1, 1);
    grid.attach_next_to(this._displayName, labelName, 1, 1, 1);

    grid.attach(labelService, 1, 2, 1, 1);
    grid.attach_next_to(this._systemName,labelService, 1, 1, 1);

    let addToolbar = new Gtk.Toolbar({ hexpand: true });
    addToolbar.get_style_context().add_class(Gtk.STYLE_CLASS_INLINE_TOOLBAR);

    servicesPage.add(addToolbar);

    let addButton = new Gtk.ToolButton({
      stock_id:     Gtk.STOCK_ADD,
      label:        'Add',
      is_important: true
    });

    addButton.connect('clicked', Lang.bind(this, this._add));
    addToolbar.add(addButton);

    this._changedPermitted = true;

    this._refresh();
    this._onSelectionChanged();
  },

  _getSystemdServicesList(type) {
    let cmd_1 = 'sh -c "systemctl --' + type + ' list-unit-files --type=service,timer --no-legend | awk \'{print $1}\'"';
    let [_u1, out_u1, err_u1, stat_u1] = GLib.spawn_command_line_sync(cmd_1);

    let allFiltered = out_u1.toString().split("\n");

    let cmd_2 = 'sh -c "systemctl --' + type + ' list-units --type=service,timer --no-legend | awk \'{print $1}\'"';
    let [_u2, out_u2, err_u2, stat_u2] = GLib.spawn_command_line_sync(cmd_2);

    allFiltered = allFiltered.concat(out_u2.toString().split("\n"));

    return allFiltered.sort(function (a, b) {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
  },

  _getTypeOfService(service) {
    let type = 'undefined';

    if (this._availableSystemdServices['system'].indexOf(service) != -1)
      type = 'system';
    else if (this._availableSystemdServices['user'].indexOf(service) != -1)
      type = 'user';

    return type;
  },

  _getIdFromIter(iter) {
    let displayName = this._store.get_value(iter, 0);
    let serviceName = this._store.get_value(iter, 1);
    let type        = this._store.get_value(iter, 2);

    return JSON.stringify({ name: displayName, service: serviceName, type: type });
  },

  _isValidTemplateInstance(serviceName, type) {
    let index  = serviceName.indexOf('@');
    let result = index != -1;

    if (result) {
      let templateName = serviceName.substr(0, index + 1) + '.service';
      result = result && (type == 'system' || type == 'user') && (this._availableSystemdServices[type].indexOf(templateName) != -1);
    }

    return result;
  },

  _add() {
    let displayName  = this._displayName.text.trim();
    let serviceEntry = this._systemName.text.trim();

    if (displayName.length > 0 && serviceEntry.length > 0) {
      let serviceArray = serviceEntry.split(' ');
      let serviceName  = '';
      let type         = '';

      if (serviceArray.length > 1) {
        serviceName = serviceArray[0];
        type        = serviceArray[1];
      } else {
        serviceName = serviceArray[0];
        type        = this._getTypeOfService(serviceName);
      }

      if (!this._isValidTemplateInstance(serviceName, type) && ( !(type == 'system' || type == 'user') || this._availableSystemdServices[type].indexOf(serviceName) == -1)) {
        this._messageDialog = new Gtk.MessageDialog({
          title:        'Warning',
          modal:        true,
          buttons:      Gtk.ButtonsType.OK,
          message_type: Gtk.MessageType.WARNING,
          text:         'Service does not exist.'
        });

        this._messageDialog.connect('response', () => {
          this._messageDialog.close();
        });

        this._messageDialog.show();
      } else {
        let id           = JSON.stringify({ name: displayName, service: serviceName, type: type });
        let currentItems = this._settings.get_strv('systemd');
        let index        = currentItems.indexOf(id);

        if (index < 0) {
          this._changedPermitted = false;
          currentItems.push(id);

          this._settings.set_strv('systemd', currentItems);
          this._store.set(this._store.append(), [0, 1, 2], [displayName, serviceName, type]);

          this._changedPermitted = true;
        }

        this._displayName.text = '';
        this._systemName.text  = '';
      }
    } else {
      this._messageDialog = new Gtk.MessageDialog({
        title:        'Warning',
        modal:        true,
        buttons:      Gtk.ButtonsType.OK,
        message_type: Gtk.MessageType.WARNING,
        text:         'No label and/or service specified.'
      });

      this._messageDialog.connect('response', () => {
        this._messageDialog.close();
      });

      this._messageDialog.show();
    }
  },

  _up() {
    let [any, model, iter] = this._treeView.get_selection().get_selected();

    if (any) {
      let index = this._settings.get_strv('systemd').indexOf(this._getIdFromIter(iter));
      this._move(index, index - 1);
    }
  },

  _down() {
    let [any, model, iter] = this._treeView.get_selection().get_selected();

    if (any) {
      let index = this._settings.get_strv('systemd').indexOf(this._getIdFromIter(iter));
      this._move(index, index + 1);
    }
  },

  _move(oldIndex, newIndex) {
    let currentItems = this._settings.get_strv('systemd');

    if (oldIndex < 0 || oldIndex >= currentItems.length || newIndex < 0 || newIndex >= currentItems.length)
      return;

    currentItems.splice(newIndex, 0, currentItems.splice(oldIndex, 1)[0]);

    this._settings.set_strv('systemd', currentItems);

    this._treeView.get_selection().unselect_all();
    this._treeView.get_selection().select_path(Gtk.TreePath.new_from_string(String(newIndex)));
  },

  _delete() {
    let [any, model, iter] = this._treeView.get_selection().get_selected();

    if (any) {
      let currentItems = this._settings.get_strv('systemd');
      let index        = currentItems.indexOf(this._getIdFromIter(iter));

      if (index < 0)
        return;

      currentItems.splice(index, 1);
      this._settings.set_strv('systemd', currentItems);

      this._store.remove(iter);
    }
  },

  _onSelectionChanged() {
    let [any, model, iter] = this._treeView.get_selection().get_selected();

    if (any) {
      this._selDepButtons.forEach(function(value) {
        value.set_sensitive(true);
      });
    } else {
      this._selDepButtons.forEach(function(value) {
        value.set_sensitive(false);
      });
    }
  },

  _refresh() {
    if (!this._changedPermitted)
      return;

    this._store.clear();
    this._showAddCheckbox.set_active(this._settings.get_boolean('show-add'))
    this._showRestartCheckbox.set_active(this._settings.get_boolean('show-restart'))
    this._positionCombo.set_active(this._settings.get_enum('position'))

    let currentItems = this._settings.get_strv('systemd');
    let validItems   = [];

    for (let i = 0; i < currentItems.length; i++) {
      let entry = JSON.parse(currentItems[i]);

      if (!this._isValidTemplateInstance(entry['service'], entry['type']) && (this._availableSystemdServices['all'].indexOf(entry['service']) < 0))
        continue;

      if(!('type' in entry))
        entry['type'] = this._getTypeOfService(entry['service']);

      validItems.push(JSON.stringify(entry));

      let iter = this._store.append();
      this._store.set(iter, [0, 1, 2], [entry['name'], entry['service'], entry['type']]);
    }

    this._changedPermitted = false;
    this._settings.set_strv('systemd', validItems);
    this._changedPermitted = true;
  }
});

function init() {
  Convenience.initTranslations();
}

function buildPrefsWidget() {
  let widget = new SystemdManagerSettings();
  widget.show_all();

  return widget;
}
