const Bytes  = imports.byteArray
const GLib   = imports.gi.GLib
const Config = imports.misc.config

var VERSION = parseInt(Config.PACKAGE_VERSION.replace(/^3\./, '').split('.')[0])

function safeSpawn(cmd) {
  try {
    return GLib.spawn_command_line_sync(cmd)
  } catch (e) {
    return [false, Bytes.fromString(''), null, null]
  }
}

function command(args, pipe) {
  const cmd = [].concat(args).filter(item => !!item).join(' ')
  const str = pipe ? [cmd, pipe].join(' | ') : cmd

  return safeSpawn(`sh -c "${str}"`)
}

function systemctl(type, args, pipe) {
  const cmd = [`systemctl --${type}`].concat(args)
  return command(cmd, pipe)
}

function systemctlList(type, args) {
  const res = systemctl(type, args, "awk '{print $1}'")
  const out = Bytes.toString(res[1])

  return out.split('\n').filter(item => !!item)
}

function getServicesList(type) {
  const args = ['--type=service,timer,mount', '--no-legend']

  const res1 = systemctlList(type, ['list-unit-files', ...args])
  const res2 = systemctlList(type, ['list-units', ...args])
  const list = res1.concat(res2)

  return list.sort((first, second) => {
    return first.toLowerCase().localeCompare(second.toLowerCase())
  })
}

function getServicesState(type, flag, services) {
  const res = systemctl(type, [flag, ...services])
  const out = Bytes.toString(res[1])

  return out.split('\n').reduce(
    (all, value, idx) => ({ ...all, [services[idx]]: value }), {}
  )
}

function runServiceAction(method, action, type, service) {
  let cmd = `systemctl ${action} ${service} --${type}`

  if (method == 0 && type == 'system') {
    cmd = `pkexec --user root ${cmd}`
  }

  GLib.spawn_command_line_async(`sh -c "${cmd}; exit"`)
}
