# Known issues

Found in 2026 while reconstructing the documentation from the code. None of
them is fixed yet; each item names where the problem sits.

## Security

1. **Session membership check passes for unknown sessions.**
   `userIsMemberInAllSessions` (`files/src/utils/AuthorizationHelper.ts`,
   `subscriptions/src/resolvers/Resolvers.ts`) reduces over the matching
   membership records starting with `true`. If the files or subscriptions
   service has no record for the session id, the check returns `true`, so
   anyone can read files of, attach files to, or subscribe to a session the
   service does not know (yet).
2. **Uploads into any session.** `getSignedFileUploadLink` does not check
   that the caller is a member of `sessionId`, so any user can upload files
   into any session whose id they know.
3. **Upload quota is never enforced.** `calculateRemainingUploadSpace`
   (`files/src/resolvers/resolvers.ts`) filters by `creator: userId`, but
   `creator` stores the nickname (`files/src/utils/UploadListener.ts`), so
   the used space is always 0.
4. **Nickname used as identity.** `deleteFile` and `removeFileFromSession`
   accept `nickname === file.creator` as proof of authorship. Nicknames are
   not unique.
5. **No access check on `allUsers` and `allSessions`.** Any logged-in user
   can list all users and all sessions with their ids, titles and members.
   The session ids alone are enough to join as participant.
6. **`File.downloadLink` never expires** and is not bound to a user; any
   valid access token can use it.
7. **Upload link encryption key and IV are random per process start and
   the IV is reused** (`files/src/utils/URLSigner.ts`). Links break after a
   restart, and a static IV weakens the encryption.
8. **`prolongSession` has no upper bound** and is allowed for any member,
   so guests can keep a session alive indefinitely.

## Wrong behaviour

9. **`joinSessionAsOwner` leaves the user in the participant list** of the
   returned session, because it looks up `args.userId` (undefined) instead
   of the current user (`sessions/src/resolvers/Resolvers.ts`).
10. **Default session lifetime is 120 seconds.** `SHORT` (the default `ttl`)
    is 120 s, while `X_SHORT` is 4 h (`sessions/src/types/DeletionDelay.ts`).
    Probably a test value left in.
11. **`createOrLoginUser` with a dd_services token creates a new guest**
    instead of returning the current user.
12. **Guest deletion on session delete is too broad.** The users service
    deletes all guests of a deleted session (when that session had no parent),
    even if they are still members of other sessions
    (`users/src/utils/EventMessageProcessorCreator.ts`).
13. **`USER_DELETED` is never delivered.** It is published to the channel
    `<userId>` instead of `user_<userId>`
    (`subscriptions/src/utils/EventMessageProcessorCreator.ts`).
14. **File owner changes are sent to the wrong channel.** `fileUpdated`
    passes the user difference to `notifyFileDifference`, which publishes
    to `session_<userId>`.
15. **No `SESSION_ADDED` for joins.** Users added to an existing session get
    no `userUpdates` event; only the session channel gets `USER_ADDED`.
16. **`getAllFilesOfUser` spreads the client filter into the Prisma where
    clause**, so the filter's shape is passed to the database unchecked.
17. **`FileUploadRequest.description` is ignored**; files are always saved
    with an empty description.

## Maintenance

18. Dependencies and runtimes are from 2022: Node 14 and 16 images (both
    end of life), `apollo-server` 3 (end of life) next to `@apollo/server` 4,
    Prisma 4, and the Keycloak `/auth/` URL prefix that Keycloak dropped in
    version 17.
19. No unit tests; only the Postman end-to-end collection.
20. Debug logging of whole file lists and of subscription contexts
    (`console.log(userFiles)`, `console.log(context)`).
21. `gateway/src/reviews.ts` and `gateway/src/locations.ts` are tutorial
    leftovers and unused.
22. The gateway sends a hard-coded fallback introspection token `abc123`
    when `INTROSPECTION_BEARER_TOKEN` is unset.
23. The Postman collection still contains joke session titles.
