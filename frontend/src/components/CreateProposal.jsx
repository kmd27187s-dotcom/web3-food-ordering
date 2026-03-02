import { useState } from "react";

export default function CreateProposal({ onSubmit, disabled }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("60");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit(title.trim(), description.trim(), Number(duration));
    setTitle("");
    setDescription("");
    setDuration("60");
  };

  return (
    <form className="create-form" onSubmit={handleSubmit}>
      <h2>Create Proposal (costs 0.001 ETH)</h2>
      <input
        type="text"
        placeholder="Proposal title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        disabled={disabled}
      />
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        disabled={disabled}
      />
      <div className="duration-row">
        <label>
          Duration (minutes):
          <input
            type="number"
            min="1"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            disabled={disabled}
          />
        </label>
      </div>
      <button className="btn primary" type="submit" disabled={disabled}>
        Submit Proposal
      </button>
    </form>
  );
}
