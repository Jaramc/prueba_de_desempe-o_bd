// it makes sure every document has the required fields

db.createCollection("audit_logs", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["action", "entity", "deleted_record", "performed_at"],
      properties: {
        action: {
          bsonType: "string",
          description: "must be a string and is required",
        },
        entity: {
          bsonType: "string",
          description: "must be a string and is required",
        },
        deleted_record: {
          bsonType: "object",
          description: "must be an object with the data that was deleted",
        },
        performed_at: {
          bsonType: "date",
          description: "must be a date",
        },
      },
    },
  },
  validationAction: "error",
});

// unique index to avoid duplicate transaction logs (optional but good practice)
db.audit_logs.createIndex({ "deleted_record.id": 1, action: 1 });

print("audit_logs collection created with schema validation");
