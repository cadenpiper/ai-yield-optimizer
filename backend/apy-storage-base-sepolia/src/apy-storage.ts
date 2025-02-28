import {
  APYUpdated as APYUpdatedEvent,
  OwnershipTransferred as OwnershipTransferredEvent
} from "../generated/APYStorage/APYStorage"
import { APYUpdated, OwnershipTransferred } from "../generated/schema"

export function handleAPYUpdated(event: APYUpdatedEvent): void {
  let entity = new APYUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.pool = event.params.pool
  entity.apy = event.params.apy
  entity.timestamp = event.params.timestamp

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
