ALTER TABLE proposals ADD COLUMN group_id INTEGER REFERENCES groups(id);
