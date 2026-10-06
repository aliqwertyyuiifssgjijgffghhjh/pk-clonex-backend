export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    app: "Pk CloneX Team",
    message: "Backend is running"
  });
}
