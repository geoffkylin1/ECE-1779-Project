import { useParams } from 'react-router-dom'
import { Placeholder } from './Placeholder'

export function GroupDetailPage() {
  const { groupId } = useParams()
  return <Placeholder title={`Group ${groupId ?? ''}`} />
}
