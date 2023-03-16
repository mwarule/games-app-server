const db = require("./app/models");
const Role = db.role;
const Permission = db.permission;
const fs = require('fs')

exports.importPermissions = async () => {
  Permission.estimatedDocumentCount(async (err, count) => {
      if (err) {
        console.log("Error while importing permissions", err)
      } else {
        if(count) {
          console.log("Permissions exists in database. Hence, skipping import")
        } else {
          console.log("No Permissions exist in the database. Hence, importing permissions...")
          const data = JSON.parse(fs.readFileSync('./app/utils/permissions.json', 'utf-8'))
          await Permission.create(data)
          console.log("Permissions imported successfully...")
        }
      }
  });
}

exports.initRoles = async () => {
  Role.estimatedDocumentCount(async (err, count) => {
      if (err) {
        console.log("Error while importing Role", err)
      } else {
        if(count) {
          console.log("Roles exists in database. Hence, skipping import")
        } else {
          console.log("No Roles exist in the database. Hence, importing permissions...")
          const permissions = await Permission.find({})
          let ids = permissions.map((p => p._id))
          await Role.create({
            name: 'administrator',
            description: 'Admin Role',
            permissions: ids
          })
          console.log("Roles imported successfully...")
        }
      }
  });
}