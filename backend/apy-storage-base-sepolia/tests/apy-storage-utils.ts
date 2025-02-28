import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts"
import {
  APYUpdated,
  OwnershipTransferred
} from "../generated/APYStorage/APYStorage"

export function createAPYUpdatedEvent(
  pool: Address,
  apy: BigInt,
  timestamp: BigInt
): APYUpdated {
  let apyUpdatedEvent = changetype<APYUpdated>(newMockEvent())

  apyUpdatedEvent.parameters = new Array()

  apyUpdatedEvent.parameters.push(
    new ethereum.EventParam("pool", ethereum.Value.fromAddress(pool))
  )
  apyUpdatedEvent.parameters.push(
    new ethereum.EventParam("apy", ethereum.Value.fromUnsignedBigInt(apy))
  )
  apyUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "timestamp",
      ethereum.Value.fromUnsignedBigInt(timestamp)
    )
  )

  return apyUpdatedEvent
}

export function createOwnershipTransferredEvent(
  previousOwner: Address,
  newOwner: Address
): OwnershipTransferred {
  let ownershipTransferredEvent =
    changetype<OwnershipTransferred>(newMockEvent())

  ownershipTransferredEvent.parameters = new Array()

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam(
      "previousOwner",
      ethereum.Value.fromAddress(previousOwner)
    )
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferredEvent
}
