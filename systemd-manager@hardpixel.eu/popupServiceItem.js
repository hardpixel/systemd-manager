const Lang      = imports.lang;
const St        = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;

var PopupServiceItem = new Lang.Class({
  Name: 'PopupServiceItem',

  _init(text, active, params) {
    this.params = params || {};
    this.widget = new PopupMenu.PopupSwitchMenuItem(text, active);

    this._restartButton();
  },

  _icon(icon_name) {
    let icon = new St.Icon({ icon_name: icon_name });
    return icon;
  },

  _button(button_name, icon_name) {
    let options = {
      x_align:         1,
      reactive:        true,
      can_focus:       true,
      track_hover:     true,
      accessible_name: button_name,
      style_class:     'system-menu-action systemd-manager-button'
    };

    let button   = new St.Button(options);
    button.child = this._icon(icon_name);

    return button;
  },

  _restartButton() {
    if (!this.params.restartButton) return;

    this.restartButton = this._button('restart', 'view-refresh-symbolic');
    this.widget.add(this.restartButton, { expand: false, x_align: St.Align.END });
  }
});
