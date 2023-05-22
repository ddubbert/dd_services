import { gql } from 'apollo-server'

export default gql`
  scalar DateTime
  
  type Query @rateLimit(limit: 150, duration: 60){
    "All files of a user"
    getAllFilesOfUser(filter: FileFilter): [File!]!
    "All files of a session"
    getAllFilesOfSession(sessionId: ID!, filter: FileFilter): [File!]!
    getFile(fileId: ID!): File!
    getDownloadLinkForFilesOfSession(sessionId: ID!): FileLinkDetails!
    getDownloadLinkForFilesOfUser: FileLinkDetails!
    getFileUploadLink(sessionId: String): FileLinkDetails!
    getSignedFileUploadLink(sessionId: String, files: [FileUploadRequest!]!): FileLinkDetails!
  }

  type Mutation @rateLimit(limit: 150, duration: 60){
    addFileToSession(fileId: ID!, sessionId: ID!): File!
    copyFile(fileId: ID!): File!
    removeFileFromSession(fileId: ID!, sessionId: ID!): DeletionResponse!
    deleteFile(fileId: ID!): DeletionResponse!
  }
  
  type FileLinkDetails {
      url: String!
      ttl: Int!
  }

  type File @key(fields: "id"){
    id: ID!
    name: String!
    description: String
    downloadLink: String!
    type: FileType!
    mimetype: String!
    size: Float!
    creator: String!
    owner: User
    sessions: [Session!]
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
    files: [File!]
  }

  type Session @key(fields: "id") {
    id: ID!
    files: [File!]
  }

  type DeletionResponse @shareable {
      status: DeletionStatus!
      message: String
  }

  enum DeletionStatus {
      SUCCESSFUL
      UNSUCCESSFUL
  }
  
  input FileFilter {
      permanent: Boolean = false
      creator: String
      type: FileType
  }

  input FileUploadRequest {
      name: String!
      mimetype: String!
      size: Float!
      description: String
  }

  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])
`
