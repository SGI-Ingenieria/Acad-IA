// AsignaturaNode.tsx
import { Handle, Position } from '@xyflow/react'

import AsignaturaCardItem from './AsignaturaCardItem'

export default function AsignaturaNode({ data }: any) {
  const isActive = data.isActive
  console.log(data)

  return (
    <div
      style={{
        transform: isActive ? 'scale(1.08)' : 'scale(1)',
        zIndex: isActive ? 10 : 1,
      }}
    >
      <Handle type="target" position={Position.Top} />

      <div>
        <AsignaturaCardItem
          asignatura={data.asignatura}
          lineaColor={data.lineaColor}
          onDragStart={() => {}}
          isDragging={false}
          onClick={() => {}}
          onViewSeriacion={data.onViewSeriacion}
          isActive={data.isActive}
          isModalOpen={data.isModalOpen}
          hasSeriacion
        />
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
