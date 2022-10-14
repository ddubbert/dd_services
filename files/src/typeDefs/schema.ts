import {gql} from 'apollo-server'

export default gql`
  scalar DateTime

  type Query {
    "The full list of locations presented by the Interplanetary Space Tourism department"
    allFiles: [File!]!
    fileUploadLink: String!
  }

  type Mutation {
    createFile(input: FileCreateInput): File!
  }

  input FileCreateInput {
    name: String!
    description: String
    owner: ID
  }

  type File @key(fields: "id"){
    id: ID!
    name: String!
    description: String
    path: String!
    type: FileType!
    owner: User
    createdAt: DateTime!
    updatedAt: DateTime!
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
    files: [File!]!
  }

  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@external"])
`
