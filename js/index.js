import { of, combineLatest } from 'rxjs'
import { ajax } from 'rxjs/ajax'
import { filter, pluck, reduce, map, concatMap } from 'rxjs/operators'

import { format, parse, isWithinRange } from 'date-fns';

import getValidaters from './validation'

const validaters = getValidaters()

const data = ajax.getJSON('/transactions.json').pipe(
  pluck('transactions'),
);

/*
 * Data PipeLine/Filters
 */
const backToArray = reduce((data, x) => [...data, x], [])
const filterIsBuy = isBuy => filter(x => x.is_buy === isBuy)
const plunkData = map(({ date, is_buy, quantity, unit_price }) => ({
  date,
  quantity,
  is_buy,
  unit_price,
}))
const inDateRange = ([start, end]) => filter(x => {
  // parsing error could occur here
  const date = parse(x.date)
  // adding one dya makes the range exclusive
  return isWithinRange(date, start, end) 
})

const filterData = combineLatest(data, validaters).pipe(
  concatMap(([data, filterValues]) => {
    // If filterValues is null that means there is a validation error
    // Therefore don't show any data to the use
    if (filterValues == null) {
      return of([])
    }

    const [isBuy, dateRange] = filterValues
    console.log('Building data ...', data.length, isBuy, dateRange)
    return of(...data).pipe(
      filterIsBuy(isBuy),
      inDateRange(dateRange),
      plunkData,
      backToArray,
    )
  })
)

/*
 * DOM Manipulation
 */

const transactionsEl = document.getElementById('transactions')
filterData.subscribe(transactions => {
  console.log(transactions.length)
  // This will remove all child elements from the transaction element
  while (transactionsEl.lastChild) {
    transactionsEl.lastChild.remove()
  }

  for (let transaction of transactions) {
    const { date, unit_price, is_buy, quantity } = transaction
    let article = document.createElement('article')

    let dateEl = document.createElement('div')
    dateEl.textContent = format(date, 'MMM, D')
    article.appendChild(dateEl)

    let amount = document.createElement('div')
    amount.textContent = quantity * unit_price
    article.appendChild(amount)

    transactionsEl.appendChild(article)
  }
})