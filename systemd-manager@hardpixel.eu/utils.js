import GLib from 'gi://GLib'

function safeSpawn(cmd) {
  try {
    return GLib.spawn_command_line_sync(cmd)
  } catch (e) {
    return [false, [], null, null]
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
  const out = String.fromCharCode(...res[1])

  return out.split('\n').filter(item => !!item)
}

function systemctlStates(type, flag, services) {
  const res = systemctl(type, [flag, ...services])
  const out = String.fromCharCode(...res[1])

  return out.split('\n').reduce(
    (all, value, idx) => ({ ...all, [services[idx]]: value }), {}
  )
}

export function getServicesList(type) {
  const args = ['--type=service,timer,mount', '--no-legend']

  const res1 = systemctlList(type, ['list-unit-files', ...args])
  const res2 = systemctlList(type, ['list-units', ...args])
  const list = res1.concat(res2)

  return Array.from(new Set(list)).sort((first, second) => {
    return first.toLowerCase().localeCompare(second.toLowerCase())
  })
}

export function getServicesState(type, services) {
  const states  = {}

  const active  = systemctlStates(type, 'is-active', services)
  const enabled = systemctlStates(type, 'is-enabled', services)

  services.forEach(service => states[service] = {
    'is-active':  active[service],
    'is-enabled': enabled[service]
  })

  return states
}

export function runServiceAction(method, action, type, service) {
  let cmd = `systemctl ${action} ${service} --${type}`

  if (method == 0 && type == 'system') {
    cmd = `pkexec --user root ${cmd}`
  }

  GLib.spawn_command_line_async(`sh -c "${cmd}; exit"`)
}
