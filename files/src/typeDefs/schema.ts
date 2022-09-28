import {gql} from 'apollo-server'

export default gql`
  type Query {
    "The full list of locations presented by the Interplanetary Space Tourism department"
    allFiles: [File!]!
    fileUploadLink: String!
  }

  type File @key(fields: "id"){
    id: ID!
    name: String!
    description: String
    path: String!
    type: FileType!
    owner: User
  }

  enum FileType {
    TEXT
    IMAGE
    AUDIO
    PDF
    ERROR
  }

  type User @key(fields: "id") {
    id: ID!
    files: [File!]
  }

  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@external"])
`
