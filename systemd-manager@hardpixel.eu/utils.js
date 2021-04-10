const Bytes = imports.byteArray
const GLib  = imports.gi.GLib

function safeSpawn(cmd) {
  try {
    return GLib.spawn_command_line_sync(cmd)
  } catch (e) {
    return [false, Bytes.fromString('')]
  }
}

function command(args, pipe) {
  const cmd = [].concat(args).filter(item => !!item).join(' ')
  const str = pipe ? [cmd, pipe].join(' | ') : cmd
  const res = safeSpawn(`sh -c "${str}"`)

  return Bytes.toString(res[1])
}

function systemctl(type, args, pipe) {
  const result = command([`systemctl --${type}`].concat(args), pipe)
  return result.split('\n').filter(item => !!item)
}

function getServicesList(type) {
  const pipe = "awk '{print $1}'"
  const args = ['--type=service,timer', '--no-legend']

  const res1 = systemctl(type, ['list-unit-files', ...args], pipe)
  const res2 = systemctl(type, ['list-units', ...args], pipe)
  const list = res1.concat(res2)

  return list.sort((first, second) => {
    return first.toLowerCase().localeCompare(second.toLowerCase())
  })
}
