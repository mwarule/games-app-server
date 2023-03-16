exports.getAll = (req, res) => {
    const response = [{
        id: '1',
        name: 'Ludo King',
        description: 'A Ludo game available to play with friends - online and/or offline',
        image: 'ludo-king.webp',
        active: true
    }, {
        id: '2',
        name: 'Snakes and Ladders',
        description: 'A Snakes and Ladder available to play with friends - online and/or offline',
        image: 'snake-and-ladders.png',
        active: false
    }]
    res.status(200).send(response);
};
