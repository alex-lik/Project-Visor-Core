import ProjectDetailView from '@/views/ProjectDetailView';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ProjectDetailView params={params} />;
}
