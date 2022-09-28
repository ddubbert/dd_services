import {gql} from 'apollo-server'

export default gql`
  type Query {
    allUsers: [User!]!
  }
    
  type User @key(fields: "id") {
    id: ID!
    nickname: String!
    sessions: [ID!]!
  }

  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])
`
