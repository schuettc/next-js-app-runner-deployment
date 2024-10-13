export default function Post({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1>Post {params.id}</h1>
      <p>This is a dynamic route for post with ID: {params.id}</p>
    </div>
  );
}
