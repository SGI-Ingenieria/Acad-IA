import { QueryClient } from '@tanstack/react-query'
import { describe, expect, test } from 'bun:test'

import { isTempId, makeTempId, optimisticMutation } from './optimistic'

type Item = { id: string; nombre: string }

const createClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  })

const fnCtx = (qc: QueryClient) => ({ client: qc, meta: undefined })

const listaKey = ['planes', 'p1', 'lineas'] as const
const detalleKey = ['planes', 'detail', 'p1'] as const

describe('optimisticMutation', () => {
  test('aplica el updater y hace rollback multi-key en orden inverso', async () => {
    const qc = createClient()
    qc.setQueryData(listaKey, [{ id: 'a', nombre: 'Antes' }])
    qc.setQueryData(detalleKey, { id: 'p1', nombre: 'Plan original' })

    const bundle = optimisticMutation<unknown, { nombre: string }>({
      queryClient: qc,
      mutationKey: ['test', 'rename'],
      writes: (vars) => [
        {
          key: listaKey,
          exact: true,
          updater: (current) =>
            (current as Array<Item>).map((i) => ({
              ...i,
              nombre: vars.nombre,
            })),
        },
        {
          key: detalleKey,
          exact: true,
          updater: (current) => ({ ...(current as Item), nombre: vars.nombre }),
        },
      ],
      errorMessage: 'No se pudo renombrar.',
    })

    const context = await bundle.onMutate!({ nombre: 'Después' }, fnCtx(qc))

    expect(qc.getQueryData<Array<Item>>(listaKey)![0].nombre).toBe('Después')
    expect(qc.getQueryData<Item>(detalleKey)!.nombre).toBe('Después')

    bundle.onError!(
      new Error('falló'),
      { nombre: 'Después' },
      context,
      fnCtx(qc),
    )

    expect(qc.getQueryData<Array<Item>>(listaKey)![0].nombre).toBe('Antes')
    expect(qc.getQueryData<Item>(detalleKey)!.nombre).toBe('Plan original')
  })

  test('elimina en rollback las entradas que el updater creó desde cero', async () => {
    const qc = createClient()
    const nuevaKey = ['planes', 'detail', 'nuevo'] as const

    const bundle = optimisticMutation<unknown, { nombre: string }>({
      queryClient: qc,
      writes: (vars) => [
        {
          key: nuevaKey,
          exact: true,
          updater: () => ({ id: makeTempId(), nombre: vars.nombre }),
        },
      ],
      errorMessage: 'No se pudo crear.',
    })

    const context = await bundle.onMutate!({ nombre: 'Nueva' }, fnCtx(qc))

    expect(qc.getQueryData(nuevaKey)).toBeDefined()

    bundle.onError!(new Error('falló'), { nombre: 'Nueva' }, context, fnCtx(qc))

    // La entrada no existía: el rollback la elimina en vez de dejar basura.
    expect(qc.getQueryState(nuevaKey)).toBeUndefined()
  })

  test('escritura por prefijo alcanza todas las variantes filtradas', async () => {
    const qc = createClient()
    const root = ['asignaturas', 'catalogo'] as const
    qc.setQueryData([...root, { q: '' }], [{ id: 'x', nombre: 'X' }])
    qc.setQueryData([...root, { q: 'mat' }], [{ id: 'x', nombre: 'X' }])

    const bundle = optimisticMutation<unknown, { nombre: string }>({
      queryClient: qc,
      writes: (vars) => [
        {
          key: root,
          updater: (current) =>
            (current as Array<Item>).map((i) => ({
              ...i,
              nombre: vars.nombre,
            })),
        },
      ],
      errorMessage: 'No se pudo actualizar.',
    })

    const context = await bundle.onMutate!({ nombre: 'Y' }, fnCtx(qc))

    expect(context.snapshots).toHaveLength(2)
    expect(qc.getQueryData<Array<Item>>([...root, { q: '' }])![0].nombre).toBe(
      'Y',
    )
    expect(
      qc.getQueryData<Array<Item>>([...root, { q: 'mat' }])![0].nombre,
    ).toBe('Y')

    bundle.onError!(new Error('falló'), { nombre: 'Y' }, context, fnCtx(qc))
    expect(qc.getQueryData<Array<Item>>([...root, { q: '' }])![0].nombre).toBe(
      'X',
    )
  })

  test('reconcile sustituye el temp-id por la entidad real en onSuccess', async () => {
    const qc = createClient()
    qc.setQueryData(listaKey, [] as Array<Item>)
    const tempId = makeTempId()

    const bundle = optimisticMutation<Item, { nombre: string }>({
      queryClient: qc,
      writes: (vars) => [
        {
          key: listaKey,
          exact: true,
          updater: (current) => [
            ...(current as Array<Item>),
            { id: tempId, nombre: vars.nombre },
          ],
        },
      ],
      reconcile: (data, _vars, client) => {
        client.setQueryData<Array<Item>>(listaKey, (current) =>
          current?.map((i) => (i.id === tempId ? data : i)),
        )
      },
      errorMessage: 'No se pudo crear.',
    })

    await bundle.onMutate!({ nombre: 'Nueva línea' }, fnCtx(qc))
    expect(isTempId(qc.getQueryData<Array<Item>>(listaKey)![0].id)).toBe(true)

    bundle.onSuccess!(
      { id: 'real-1', nombre: 'Nueva línea' },
      { nombre: 'Nueva línea' },
      { snapshots: [] },
      fnCtx(qc),
    )

    const lista = qc.getQueryData<Array<Item>>(listaKey)!
    expect(lista[0].id).toBe('real-1')
    expect(isTempId(lista[0].id)).toBe(false)
  })

  test('onSettled invalida writes e invalidateOnSettle sin duplicados', async () => {
    const qc = createClient()
    qc.setQueryData(listaKey, [] as Array<Item>)
    const invalidated: Array<string> = []
    const original = qc.invalidateQueries.bind(qc)
    qc.invalidateQueries = ((filters: { queryKey: ReadonlyArray<unknown> }) => {
      invalidated.push(JSON.stringify(filters.queryKey))
      return original(filters as never)
    }) as typeof qc.invalidateQueries

    const bundle = optimisticMutation<unknown, Record<string, never>>({
      queryClient: qc,
      mutationKey: ['test', 'settle'],
      writes: () => [{ key: listaKey, exact: true, updater: (c) => c }],
      invalidateOnSettle: () => [
        [...detalleKey],
        // Duplicado intencional de un write: debe invalidarse una sola vez.
        [...listaKey],
      ],
      errorMessage: 'No se pudo guardar.',
    })

    const context = await bundle.onMutate!({}, fnCtx(qc))
    bundle.onSettled!(undefined, null, {}, context, fnCtx(qc))

    expect(invalidated).toHaveLength(2)
    expect(invalidated).toContain(JSON.stringify(listaKey))
    expect(invalidated).toContain(JSON.stringify(detalleKey))
  })

  test('onSettled no invalida mientras otra mutación hermana sigue en vuelo', async () => {
    const qc = createClient()
    const mutationKey = ['test', 'concurrent']
    qc.setQueryData(listaKey, [] as Array<Item>)

    let invalidations = 0
    const original = qc.invalidateQueries.bind(qc)
    qc.invalidateQueries = (filters: never) => {
      invalidations += 1
      return original(filters)
    }

    const bundle = optimisticMutation<unknown, Record<string, never>>({
      queryClient: qc,
      mutationKey,
      writes: () => [{ key: listaKey, exact: true, updater: (c) => c }],
      errorMessage: 'No se pudo guardar.',
    })

    // Simula DOS mutaciones pendientes con la misma key: onSettled de la
    // primera corre cuando ambas siguen 'pending' (dispatch va después).
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const m1 = qc.getMutationCache().build(qc, {
      mutationKey,
      mutationFn: () => gate,
    })
    const m2 = qc.getMutationCache().build(qc, {
      mutationKey,
      mutationFn: () => gate,
    })
    const p1 = m1.execute({})
    const p2 = m2.execute({})
    expect(qc.isMutating({ mutationKey })).toBe(2)

    const context = await bundle.onMutate!({}, fnCtx(qc))
    bundle.onSettled!(undefined, null, {}, context, fnCtx(qc))
    expect(invalidations).toBe(0)

    release()
    await Promise.all([p1, p2])

    // Con una sola pendiente (o ninguna), sí invalida.
    bundle.onSettled!(undefined, null, {}, context, fnCtx(qc))
    expect(invalidations).toBe(1)
  })

  test('scope: mutaciones de entidades distintas invalidan de forma independiente', async () => {
    const qc = createClient()
    const mutationKey = ['test', 'scoped']
    type Vars = { planId: string }
    qc.setQueryData(listaKey, [] as Array<Item>)

    let invalidations = 0
    const original = qc.invalidateQueries.bind(qc)
    qc.invalidateQueries = (filters: never) => {
      invalidations += 1
      return original(filters)
    }

    const bundle = optimisticMutation<unknown, Vars>({
      queryClient: qc,
      mutationKey,
      scope: (v) => v.planId,
      writes: () => [{ key: listaKey, exact: true, updater: (c) => c }],
      errorMessage: 'No se pudo guardar.',
    })

    // Dos mutaciones pendientes del plan p2 (una simula a la "propia", que en
    // producción sigue 'pending' durante su onSettled; la otra es la hermana).
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const build = () =>
      qc.getMutationCache().build(qc, { mutationKey, mutationFn: () => gate })
    const pendientes = [
      build().execute({ planId: 'p2' }),
      build().execute({ planId: 'p2' }),
    ]
    expect(qc.isMutating({ mutationKey })).toBe(2)

    const context = await bundle.onMutate!({ planId: 'p1' }, fnCtx(qc))

    // p1 no tiene hermanas pendientes de su MISMO scope: invalida ya.
    bundle.onSettled!(undefined, null, { planId: 'p1' }, context, fnCtx(qc))
    expect(invalidations).toBe(1)

    // p2 tiene otra hermana del mismo scope en vuelo: difiere la invalidación.
    bundle.onSettled!(undefined, null, { planId: 'p2' }, context, fnCtx(qc))
    expect(invalidations).toBe(1)

    release()
    await Promise.all(pendientes)
  })
})
